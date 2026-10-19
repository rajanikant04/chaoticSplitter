from fastapi import HTTPException
from app.config import Settings
import os
import io
import logging
from typing import Optional
from dotenv import load_dotenv

logger = logging.getLogger("chaoticSplitter.stt")

ELEVENLABS_API_KEY = Settings.ELEVENLABS_API_KEY

from app.schemas import VoiceTranscribeResponse
from app.telemetry import trace_span

def transcribe_audio_bytes(audio_bytes: bytes, filename: str = "memo.wav") -> VoiceTranscribeResponse:
    """
    Transcribes audio bytes using ElevenLabs Scribe STT.
    Returns strongly-typed VoiceTranscribeResponse schema.
    """
    with trace_span("ai.stt.elevenlabs", "ElevenLabs Scribe STT", {"filename": filename, "audio_size": len(audio_bytes)}):
        if not audio_bytes:
            raise ValueError("Audio content cannot be empty")

        if not ELEVENLABS_API_KEY or ELEVENLABS_API_KEY.startswith("your_"):
            raise ValueError("ELEVENLABS_API_KEY is not configured in backend/.env")

        try:
            from elevenlabs.client import ElevenLabs
            client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
        except Exception as e:
            logger.error(f"Failed to initialize ElevenLabs client: {e}")
            raise HTTPException(
                status_code=400,
                detail="Failed to initialize ElevenLabs client"
            )

        try:
            audio_stream = io.BytesIO(audio_bytes)
            audio_stream.name = filename

            # Check if speech_to_text is supported on the client
            if hasattr(client, "speech_to_text"):
                response = client.speech_to_text.convert(
                    file=audio_stream,
                    model_id="scribe_v1",
                )
                transcript = getattr(response, "text", "") or str(response)
                detected_language = getattr(response, "language_code", None)
                duration_seconds = getattr(response, "duration", None)
            else:
                # Fallback for alternative SDK versions with direct requests
                import requests
                headers = {"xi-api-key": ELEVENLABS_API_KEY}
                files = {"file": (filename, audio_bytes, "audio/wav")}
                data = {"model_id": "scribe_v1"}
                res = requests.post(
                    "https://api.elevenlabs.io/v1/speech-to-text",
                    headers=headers,
                    files=files,
                    data=data,
                    timeout=30,
                )
                res.raise_for_status()
                res_json = res.json()
                transcript = res_json.get("text", "")
                detected_language = res_json.get("language_code")
                duration_seconds = res_json.get("duration")

            return VoiceTranscribeResponse(
                transcript=transcript.strip(),
                detected_language=detected_language,
                duration_seconds=duration_seconds,
            )

        except Exception as exc:
            logger.error(f"Error during audio transcription: {exc}")
            raise RuntimeError(f"ElevenLabs STT error: {exc}")
