import httpx
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from typing import Optional

import os

router = APIRouter(prefix="/api/voice", tags=["voice"])

STT_SERVICE_URL = os.getenv("STT_SERVICE_URL", "http://127.0.0.1:8002/transcribe")
TTS_SERVICE_URL = os.getenv("TTS_SERVICE_URL", "http://127.0.0.1:8003/synthesize")

@router.post("/stt")
async def speech_to_text(file: UploadFile = File(...)):
    """
    Transcribe incoming audio file via Faster-Whisper service.
    """
    try:
        content = await file.read()
        files = {"file": (file.filename or "recording.wav", content, file.content_type or "audio/wav")}
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                res = await client.post(STT_SERVICE_URL, files=files)
                if res.status_code == 200:
                    return res.json()
            except Exception as e:
                print(f"STT engine note: {e}")
                
        # Mock fallback for dev mode
        return {"text": "Hello, I am testing the audio input.", "duration": 2.5}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CHARACTERS_DIR = os.path.abspath(os.path.join(BACKEND_DIR, "characters"))

@router.post("/tts")
async def text_to_speech(
    text: str = Form(...),
    voice_preset: Optional[str] = Form("female_narrator"),
    voice_sample_path: Optional[str] = Form(None),
    voice_sample_text: Optional[str] = Form(None)
):
    """
    Synthesize character voice response via TTS engine.
    """
    try:
        data = {"text": text, "voice_preset": voice_preset}
        if voice_sample_text:
            data["voice_sample_text"] = voice_sample_text
        if voice_sample_path:
            resolved_path = voice_sample_path
            if not os.path.isabs(voice_sample_path):
                sample_candidate = os.path.join(CHARACTERS_DIR, "voice_samples", voice_sample_path)
                if os.path.exists(sample_candidate):
                    resolved_path = sample_candidate
                elif os.path.exists(os.path.join(CHARACTERS_DIR, voice_sample_path)):
                    resolved_path = os.path.join(CHARACTERS_DIR, voice_sample_path)
            data["voice_sample_path"] = resolved_path

        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                res = await client.post(TTS_SERVICE_URL, data=data)
                if res.status_code == 200:
                    media_type = res.headers.get("content-type", "audio/wav")
                    return Response(content=res.content, media_type=media_type)
                else:
                    print(f"TTS service returned error: {res.status_code} {res.text}")
            except Exception as e:
                print(f"TTS engine error / timeout: {e}")

        raise HTTPException(status_code=502, detail="TTS synthesis failed or timed out.")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

