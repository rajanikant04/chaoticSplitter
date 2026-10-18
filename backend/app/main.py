from fastapi import FastAPI, UploadFile, File
from app.services.stt_service import transcribe_audio_bytes
from app.services.gemma_service import extract_group_with_gemma
from app.services.ocr_service import parse_receipt_image
from app.services.split_service import generate_split_plan_with_gemma
from app.schemas import (
    VoiceTranscribeResponse,
    GroupParseResponse,
    ReceiptSchema,
    SplitPlanRequest,
    VoiceSplitPlan,
)


app = FastAPI(
    title="ChaoticSplitter API",
    description="Multimodal Receipt & Voice Splitter API",
    version="1.0.0",
)

@app.get("/api/health")
def health_check():
    """Simple ping endpoint to verify frontend-backend integration."""
    return {
        "status": "ok",
        "message": "FastAPI Backend is running and connected successfully!",
        "version": "1.0.0",
    }

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
    2. Sends transcript to Hugging Face Gemma 2 to extract group name & members JSON.
    3. Returns structured GroupParseResponse to frontend.
    """
    audio_content = await file.read()
    stt_res = transcribe_audio_bytes(audio_content, filename=file.filename or "memo.wav")
    print("Transcript from Gemma : ", stt_res)
    # Process transcript through Gemma 2
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