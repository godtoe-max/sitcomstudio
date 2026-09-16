import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
PORT = int(os.getenv("PORT", 8000))
HOST = os.getenv("HOST", "127.0.0.1")

# Flagship Model Roster
# Showrunner: Claude Haiku 4.5 (active key tier), with fallbacks
SHOWRUNNER_MODELS = [
    "claude-haiku-4-5-20251001",
    "claude-3-5-sonnet-20241022",
    "claude-3-7-sonnet-20250219"
]

# Cast Agents: OpenAI GPT-4o
CHARACTER_MODEL = "gpt-4o"

# Illustrated storyboards are drawn by Claude using the existing Anthropic account.
ART_MODEL = os.getenv("ANTHROPIC_ART_MODEL", "claude-sonnet-4-6").strip()
IMAGE_CACHE_DIR = Path(__file__).resolve().parent.parent / "static" / "image_cache"

# Voice Speech Synthesis: OpenAI TTS-1-HD (Featuring Fable, Onyx, Echo, Nova, Alloy)
TTS_MODEL = "gpt-4o-mini-tts"
CHARACTER_VOICES = ["fable", "onyx", "echo", "nova", "alloy", "shimmer"]

AUDIO_CACHE_DIR = Path(__file__).resolve().parent.parent / "static" / "audio_cache"
AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Quick diagnostics
def check_api_keys():
    status = {
        "openai": bool(OPENAI_API_KEY and OPENAI_API_KEY.startswith("sk-")),
        "anthropic": bool(ANTHROPIC_API_KEY and ANTHROPIC_API_KEY.startswith("sk-ant-"))
    }
    return status

