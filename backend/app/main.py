import os
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, File
from app.services.stt_service import transcribe_audio_bytes
from app.services.gemma_service import extract_group_with_gemma
from app.services.ocr_service import parse_receipt_image
from app.services.split_service import generate_split_plan_with_gemma
from app.services.anomaly_service import audit_receipt_with_tabpfn
from app.math_engine import compute_settlement
from app.telemetry import init_sentry, trace_span, capture_agent_event
from app.config import settings
from app.schemas import (
    VoiceTranscribeResponse,
    GroupParseResponse,
    ReceiptSchema,
    SplitPlanRequest,
    VoiceSplitPlan,
    CalculateSettlementRequest,
    SettlementSummary,
)

from fastapi.middleware.cors import CORSMiddleware

# Initialize Sentry distributed tracing and error monitoring
init_sentry()

app = FastAPI(
    title="ChaoticSplitter API",
    description="Multimodal Receipt & Voice Splitter API with Prior Labs TabPFN & Sentry Observability",
    version="1.0.0",
)

origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    """Ping endpoint to verify backend, Sentry tracing, and TabPFN status."""
    return {
        "status": "ok",
        "message": "FastAPI Backend is running and connected successfully!",
        "version": "1.0.0",
        "sentry_enabled": bool(settings.SENTRY_DSN),
        "tabpfn_configured": bool(settings.TABPFN_API_KEY),
    }

@app.get("/api/sentry-test")
def test_sentry():
    """Test endpoint to generate a trace span and breadcrumb in Sentry dashboard."""
    with trace_span("telemetry.test", "Manual Sentry Agent Verification Ping", {"ping": "success"}):
        capture_agent_event("sentry_agent_ping", {"hackathon": "hacktoberfest", "status": "active"})
    return {
        "status": "ok",
        "message": "Trace span recorded and submitted to Sentry!",
        "dsn_configured": bool(settings.SENTRY_DSN),
    }

@app.post("/api/audit/tabpfn")
async def audit_tabpfn(receipt: ReceiptSchema, num_people: int = 3):
    """Directly invokes Prior Labs TabPFN Anomaly Guardian & Tip Predictor."""
    return audit_receipt_with_tabpfn(receipt, num_people=num_people)

@app.post("/api/transcribe", response_model=VoiceTranscribeResponse)
async def transcribe_voice(file: UploadFile = File(...)):
    """Transcribes audio memo using ElevenLabs Scribe STT."""
    audio_content = await file.read()
    return transcribe_audio_bytes(audio_content, filename=file.filename or "memo.wav")

@app.post("/api/groups", response_model=GroupParseResponse)
async def setup_group_from_audio(file: UploadFile = File(...)):
    """
    Step 0 audio pipeline:
    1. Transcribes incoming audio with ElevenLabs Scribe STT.
    2. Sends transcript to Hugging Face Gemma 4 to extract group name & members JSON.
    3. Returns structured GroupParseResponse to frontend.
    """
    audio_content = await file.read()
    stt_res = transcribe_audio_bytes(audio_content, filename=file.filename or "memo.wav")
    print("Transcript from Gemma : ", stt_res)
    # Process transcript through Gemma 4
    gemma_res = extract_group_with_gemma(stt_res.transcript)
    
    return GroupParseResponse(
        group_name=gemma_res["group_name"],
        members=gemma_res["members"],
        transcript=stt_res.transcript,
    )

@app.post("/api/receipts", response_model=ReceiptSchema)
async def process_receipt(file: UploadFile = File(...)):
    """
    Step 1 Receipt OCR pipeline:
    Receives receipt image, processes via Ollama Cloud vision OCR,
    and returns strongly-typed ReceiptSchema.
    """
    image_content = await file.read()
    return parse_receipt_image(image_content, filename=file.filename or "receipt.jpg")

@app.post("/api/split-plan", response_model=VoiceSplitPlan)
async def create_split_plan(request: SplitPlanRequest):
    """
    Step 2 Explain Split pipeline:
    Maps receipt line items to group members based on user voice/text instructions
    using Gemma 4 (gemma4:31b) semantic reasoning.
    """
    return generate_split_plan_with_gemma(request)

@app.post("/api/verify", response_model=SettlementSummary)
async def verify_and_calculate(request: CalculateSettlementRequest):
    """
    Step 3 Verify & Calculate endpoint:
    Uses the deterministic Python Decimal math engine to compute proportional shares,
    taxes, tips, discounts, and zero-leakage penny reconciliation from the provided JSON.
    """
    return compute_settlement(
        receipt=request.receipt,
        plan=request.plan,
        payer_name=request.payer_name or "Me",
        payer_upi_vpa=request.payer_upi_vpa,
    )

@app.post("/api/settle", response_model=SettlementSummary)
async def settle_and_generate_payments_endpoint(request: CalculateSettlementRequest):
    """
    Step 4 Settle & Pay endpoint:
    Calculates zero-leakage settlement breakdown and generates dynamic UPI QR codes
    for each non-payer participant to scan and pay the payer directly.
    """
    return compute_settlement(
        receipt=request.receipt,
        plan=request.plan,
        payer_name=request.payer_name or "Me",
        payer_upi_vpa=request.payer_upi_vpa,
    )