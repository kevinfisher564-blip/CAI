import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.characters import router as characters_router
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
app.include_router(chat_router)
app.include_router(voice_router)

# Mount characters directory for static avatar & voice sample serving
CHARACTERS_DIR = os.path.abspath("backend/characters")
os.makedirs(CHARACTERS_DIR, exist_ok=True)
app.mount("/static/characters", StaticFiles(directory=CHARACTERS_DIR), name="characters_static")

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "system": "Multimodal Character AI Orchestrator",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
