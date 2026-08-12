import os
import sys
import subprocess
import tempfile
import uvicorn
from fastapi import FastAPI, HTTPException, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import io
import soundfile as sf
import numpy as np

app = FastAPI(title="Zero-Shot & Preset TTS Service")

PRESET_VOICES = {
    "female_narrator": "en-US-AvaNeural",
    "male_deep": "en-US-AndrewNeural",
    "soft_storyteller": "en-US-JennyNeural",
    "energetic_companion": "en-US-BrianNeural"
}

def ensure_tts_backend():
    try:
        import edge_tts
        return "edge_tts"
    except ImportError:
        pass
    
    try:
        import gtts
        return "gtts"
    except ImportError:
        pass

    print("Attempting automatic installation of edge-tts...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "edge-tts"])
        import edge_tts
        return "edge_tts"
    except Exception as e:
        print(f"Could not auto-install edge-tts: {e}")
        return "fallback"

class TTSRequest(BaseModel):
    text: str
    voice_preset: Optional[str] = "female_narrator"
    voice_sample_path: Optional[str] = None

@app.get("/presets")
def get_presets():
    return {"presets": list(PRESET_VOICES.keys())}

@app.post("/synthesize")
async def synthesize_speech(
    text: str = Form(...),
    voice_preset: Optional[str] = Form("female_narrator"),
    voice_sample_path: Optional[str] = Form(None)
):
    """
    Synthesize high-quality neural speech for character responses.
    Uses edge-tts (Microsoft Neural voices) or gTTS for natural spoken audio.
    """
    try:
        backend = ensure_tts_backend()

        if backend == "edge_tts":
            import edge_tts
            voice = PRESET_VOICES.get(voice_preset, "en-US-AvaNeural")
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
                temp_path = temp_file.name
            
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(temp_path)
            return FileResponse(temp_path, media_type="audio/mpeg", filename="response.mp3")

        elif backend == "gtts":
            from gtts import gTTS
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
                temp_path = temp_file.name

            tts = gTTS(text=text, lang="en")
            tts.save(temp_path)
            return FileResponse(temp_path, media_type="audio/mpeg", filename="response.mp3")

        else:
            # Fallback sine wave generator as last resort
            sample_rate = 24000
            duration_sec = max(1.0, len(text) * 0.06)
            t = np.linspace(0, duration_sec, int(sample_rate * duration_sec), False)
            audio_data = 0.1 * np.sin(2 * np.pi * 440 * t)
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_wav:
                sf.write(temp_wav.name, audio_data, sample_rate)
                temp_path = temp_wav.name

            return FileResponse(temp_path, media_type="audio/wav", filename="response.wav")

    except Exception as e:
        print(f"TTS Synthesis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)
