from fastapi import FastAPI, UploadFile, File
from app.services.stt_service import transcribe_audio_bytes
from app.schemas import VoiceTranscribeResponse

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


