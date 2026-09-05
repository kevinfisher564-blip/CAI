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

import re

EMOJI_PATTERN = re.compile(
    "["
    "\U0001F1E0-\U0001F1FF"  # flags
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F680-\U0001F6FF"  # transport & map symbols
    "\U0001F700-\U0001F77F"  # alchemical symbols
    "\U0001F780-\U0001F7FF"  # geometric shapes
    "\U0001F800-\U0001F8FF"  # arrows
    "\U0001F900-\U0001F9FF"  # supplemental symbols and pictographs
    "\U0001FA00-\U0001FA6F"  # symbols and pictographs extended-A
    "\U0001FA70-\U0001FAFF"  # symbols and pictographs extended-B
    "\U00002700-\U000027BF"  # dingbats
    "\U00002600-\U000026FF"  # misc symbols
    "\U00002B50-\U00002B55"  # star symbols
    "\U0000200D"            # zero-width joiner
    "\U0000FE00-\U0000FE0F"  # variation selectors
    "]+",
    flags=re.UNICODE
)

def clean_text_for_tts(raw_text: str) -> str:
    """Strip emojis and normalize whitespace for natural speech synthesis."""
    if not raw_text:
        return ""
    # Strip emojis
    cleaned = EMOJI_PATTERN.sub("", raw_text)
    # Normalize excess whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned

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

_f5tts_instance = None

def get_f5tts_instance():
    global _f5tts_instance
    if _f5tts_instance is None:
        try:
            from f5_tts.api import F5TTS
            print("Initializing F5-TTS zero-shot voice model...")
            _f5tts_instance = F5TTS()
            print("F5-TTS model initialized successfully.")
        except ImportError:
            print("f5_tts package not installed. Preset neural voices will be used.")
            return None
        except Exception as e:
            print(f"Failed to initialize F5TTS model: {e}")
            return None
    return _f5tts_instance

@app.post("/synthesize")
async def synthesize_speech(
    text: str = Form(...),
    voice_preset: Optional[str] = Form("female_narrator"),
    voice_sample_path: Optional[str] = Form(None),
    voice_sample_text: Optional[str] = Form(None)
):
    """
    Synthesize high-quality neural speech for character responses.
    Uses F5-TTS for zero-shot voice cloning with reference audio, or edge-tts/gTTS for presets.
    """
    try:
        spoken_text = clean_text_for_tts(text)
        if not spoken_text:
            spoken_text = "..."

        # 1. Zero-Shot Voice Cloning if voice_sample_path is provided and exists
        if voice_sample_path and os.path.exists(voice_sample_path):
            f5tts = get_f5tts_instance()
            if f5tts is not None:
                try:
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_wav:
                        temp_path = temp_wav.name

                    ref_transcript = (voice_sample_text or "").strip()
                    res = f5tts.infer(
                        ref_file=voice_sample_path,
                        ref_text=ref_transcript,
                        gen_text=spoken_text,
                        file_wave=temp_path
                    )
                    # If infer returned waveform array, ensure it is written to temp_path
                    if isinstance(res, tuple) and len(res) >= 2:
                        wav_data, sample_rate = res[0], res[1]
                        if wav_data is not None and sample_rate is not None:
                            sf.write(temp_path, wav_data, sample_rate)

                    if os.path.exists(temp_path) and os.path.getsize(temp_path) > 100:
                        return FileResponse(temp_path, media_type="audio/wav", filename="cloned_response.wav")
                    else:
                        print(f"F5-TTS produced empty audio at {temp_path}. Falling back to preset '{voice_preset}'.")
                except Exception as e:
                    print(f"F5-TTS inference error: {e}. Falling back to preset '{voice_preset}'.")

        # 2. Preset Neural Voice Synthesis
        backend = ensure_tts_backend()

        if backend == "edge_tts":
            import edge_tts
            voice = PRESET_VOICES.get(voice_preset, "en-US-AvaNeural")
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
                temp_path = temp_file.name
            
            communicate = edge_tts.Communicate(spoken_text, voice)
            await communicate.save(temp_path)
            return FileResponse(temp_path, media_type="audio/mpeg", filename="response.mp3")

        elif backend == "gtts":
            from gtts import gTTS
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
                temp_path = temp_file.name

            tts = gTTS(text=spoken_text, lang="en")
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
