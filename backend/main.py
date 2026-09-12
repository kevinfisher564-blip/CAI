import os
import sys

# Ensure backend directory is in sys.path so 'app' module imports resolve cleanly
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import CHARACTERS_DIR, VOICES_DIR, SCENARIOS_DIR
from app.api.characters import router as characters_router
from app.api.scenarios import router as scenarios_router
from app.api.chat import router as chat_router
from app.api.voice import router as voice_router

app = FastAPI(
    title="Multimodal Character AI Orchestrator",
    description="Local self-hosted Character AI backend with VLM chat, zero-shot TTS, Faster-Whisper STT, and 3-Tier Story Context engine.",
    version="1.0.0"
)

# Enable CORS for local Windows 11 PC dev & SSH tunneling
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(characters_router)
app.include_router(scenarios_router)
app.include_router(chat_router)
app.include_router(voice_router)

# Ensure runtime asset directories exist
os.makedirs(CHARACTERS_DIR, exist_ok=True)
os.makedirs(VOICES_DIR, exist_ok=True)
os.makedirs(SCENARIOS_DIR, exist_ok=True)

# Mount dedicated voice sample route if VOICES_DIR is outside or distinct from CHARACTERS_DIR/voice_samples
if os.path.abspath(VOICES_DIR) != os.path.abspath(os.path.join(CHARACTERS_DIR, "voice_samples")):
    app.mount("/static/characters/voice_samples", StaticFiles(directory=VOICES_DIR), name="voice_samples_static")

# Mount characters directory for static avatar & asset serving
app.mount("/static/characters", StaticFiles(directory=CHARACTERS_DIR), name="characters_static")

# Mount voices directory for standalone voice asset serving
app.mount("/static/voices", StaticFiles(directory=VOICES_DIR), name="voices_static")

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "system": "Multimodal Character AI Orchestrator",
        "version": "1.0.0",
        "directories": {
            "characters": CHARACTERS_DIR,
            "voices": VOICES_DIR,
            "scenarios": SCENARIOS_DIR
        }
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
