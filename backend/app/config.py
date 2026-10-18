import os
from typing import List
from dotenv import load_dotenv

# Load .env file from backend root or workspace root
load_dotenv()

class Settings:
    # Ollama Cloud & Host
    OLLAMA_API_KEY: str = os.getenv("OLLAMA_API_KEY", "")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", os.getenv("OLLAMA_BASE_URL", "https://ollama.com"))
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "gemma4:31b")
    OCR_MODEL: str = os.getenv("OCR_MODEL", "gemma4:31b")

    # ElevenLabs (Scribe STT + Voice TTS)
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")

    # Prior Labs (TabPFN-3.5)
    TABPFN_API_KEY: str = os.getenv("TABPFN_API_KEY", "")

    # Sentry Observability
    SENTRY_DSN: str = os.getenv("SENTRY_DSN", "")

settings = Settings()
