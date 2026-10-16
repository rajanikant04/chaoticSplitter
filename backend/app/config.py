import os
from typing import List
from dotenv import load_dotenv

# Load .env file from backend root or workspace root
load_dotenv()

class Settings:
    # Hugging Face (Gemma Models)
    HF_TOKEN: str = os.getenv("HF_TOKEN", "")
    GEMMA_MODEL: str = os.getenv("GEMMA_MODEL", "google/gemma-2-9b-it")

    # ElevenLabs (Scribe STT + Voice TTS)
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
    ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")

    # Prior Labs (TabPFN-3.5)
    TABPFN_API_KEY: str = os.getenv("TABPFN_API_KEY", "")

    # Sentry Observability
    SENTRY_DSN: str = os.getenv("SENTRY_DSN", "")

settings = Settings()
