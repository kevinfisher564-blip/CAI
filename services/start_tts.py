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
import re

app = FastAPI(title="Multi-Engine Zero-Shot & Preset TTS Service")

TTS_ENGINE = os.getenv("TTS_ENGINE", "omnivoice").lower()

PRESET_VOICES = {
    "female_narrator": "en-US-AvaNeural",
    "male_deep": "en-US-AndrewNeural",
    "soft_storyteller": "en-US-JennyNeural",
    "energetic_companion": "en-US-BrianNeural"
}

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
    cleaned = EMOJI_PATTERN.sub("", raw_text)
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
    voice_sample_text: Optional[str] = None

@app.get("/engine")
def get_engine_info():
    return {
        "engine": TTS_ENGINE,
        "supported_engines": ["omnivoice", "f5_tts", "edge_tts"],
        "presets": list(PRESET_VOICES.keys())
    }

@app.get("/presets")
def get_presets():
    return {"presets": list(PRESET_VOICES.keys())}

# ---------------------------------------------------------------------------
# 1. OmniVoice Zero-Shot Model Singleton
# ---------------------------------------------------------------------------
_omnivoice_instance = None

def get_omnivoice_instance():
    global _omnivoice_instance
    if _omnivoice_instance is None:
        try:
            import torch
            from omnivoice import OmniVoice
            print("Initializing OmniVoice zero-shot voice model (k2-fsa/OmniVoice)...")
            device = "cuda:0" if torch.cuda.is_available() else "cpu"
            dtype = torch.float16 if torch.cuda.is_available() else torch.float32
            _omnivoice_instance = OmniVoice.from_pretrained(
                "k2-fsa/OmniVoice",
                device_map=device,
                dtype=dtype
            )
            print("OmniVoice model initialized successfully.")
        except ImportError:
            print("omnivoice package not installed. Run 'pip install omnivoice'.")
            return None
        except Exception as e:
            print(f"Failed to initialize OmniVoice model: {e}")
            return None
    return _omnivoice_instance

# ---------------------------------------------------------------------------
# 2. F5-TTS Zero-Shot Model Singleton
# ---------------------------------------------------------------------------
_f5tts_instance = None

def get_f5tts_instance():
    global _f5tts_instance
    if _f5tts_instance is None:
        try:
            from f5_tts.api import F5TTS
            print("Initializing F5-TTS zero-shot voice model (SWivid/F5-TTS)...")
            _f5tts_instance = F5TTS()
            print("F5-TTS model initialized successfully.")
        except ImportError:
            print("f5_tts package not installed.")
            return None
        except Exception as e:
            print(f"Failed to initialize F5TTS model: {e}")
            return None
    return _f5tts_instance

# ---------------------------------------------------------------------------
# Inference Helpers
# ---------------------------------------------------------------------------
def synthesize_with_omnivoice(spoken_text: str, voice_sample_path: str, voice_sample_text: Optional[str], temp_path: str) -> bool:
    ov = get_omnivoice_instance()
    if ov is None:
        return False
    try:
        kwargs = {
            "text": spoken_text,
            "ref_audio": voice_sample_path
        }
        if voice_sample_text and voice_sample_text.strip():
            kwargs["ref_text"] = voice_sample_text.strip()

        audio_res = ov.generate(**kwargs)

        sample_rate = 24000
        audio_data = audio_res

        # OmniVoice returns a list of NumPy arrays (e.g. [np.ndarray])
        if isinstance(audio_res, list) and len(audio_res) > 0:
            audio_data = audio_res[0]
        elif isinstance(audio_res, tuple) and len(audio_res) >= 2:
            audio_data, sample_rate = audio_res[0], audio_res[1]
        elif isinstance(audio_res, dict):
            audio_data = audio_res.get("audio") or audio_res.get("wav") or audio_res
            sample_rate = audio_res.get("sampling_rate") or audio_res.get("sample_rate") or 24000

        # Convert PyTorch tensor to NumPy if necessary
        if hasattr(audio_data, "detach"):
            audio_data = audio_data.detach().cpu().numpy()

        audio_data = np.asarray(audio_data, dtype=np.float32)
        audio_data = np.squeeze(audio_data)

        # Remove 0-byte placeholder if present before sf.write
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

        sf.write(temp_path, audio_data, int(sample_rate), format="WAV", subtype="PCM_16")
        return os.path.exists(temp_path) and os.path.getsize(temp_path) > 100
    except Exception as e:
        print(f"OmniVoice synthesis error: {e}")
        import traceback
        traceback.print_exc()
        return False

def synthesize_with_f5tts(spoken_text: str, voice_sample_path: str, voice_sample_text: Optional[str], temp_path: str) -> bool:
    f5tts = get_f5tts_instance()
    if f5tts is None:
        return False
    try:
        ref_transcript = (voice_sample_text or "").strip()
        res = f5tts.infer(
            ref_file=voice_sample_path,
            ref_text=ref_transcript,
            gen_text=spoken_text,
            file_wave=temp_path
        )
        if isinstance(res, tuple) and len(res) >= 2:
            wav_data, sample_rate = res[0], res[1]
            if wav_data is not None and sample_rate is not None:
                sf.write(temp_path, wav_data, int(sample_rate), format="WAV", subtype="PCM_16")
        return os.path.exists(temp_path) and os.path.getsize(temp_path) > 100
    except Exception as e:
        print(f"F5-TTS synthesis error: {e}")
        return False

@app.post("/synthesize")
async def synthesize_speech(
    text: str = Form(...),
    voice_preset: Optional[str] = Form("female_narrator"),
    voice_sample_path: Optional[str] = Form(None),
    voice_sample_text: Optional[str] = Form(None)
):
    """
    Synthesize high-quality neural speech for character responses.
    Uses OmniVoice or F5-TTS for zero-shot voice cloning with reference audio,
    or edge-tts/gTTS for presets.
    """
    try:
        spoken_text = clean_text_for_tts(text)
        if not spoken_text:
            spoken_text = "..."

        # 1. Zero-Shot Voice Cloning if voice_sample_path is provided and exists
        if voice_sample_path and os.path.exists(voice_sample_path):
            temp_fd, temp_path = tempfile.mkstemp(suffix=".wav")
            os.close(temp_fd)
            if os.path.exists(temp_path):
                os.remove(temp_path)

            success = False
            active_engine = TTS_ENGINE.replace("-", "_")

            if "omni" in active_engine:
                # Primary: OmniVoice, Secondary Fallback: F5-TTS
                success = synthesize_with_omnivoice(spoken_text, voice_sample_path, voice_sample_text, temp_path)
                if not success:
                    print("OmniVoice failed or uninitialized. Falling back to F5-TTS...")
                    success = synthesize_with_f5tts(spoken_text, voice_sample_path, voice_sample_text, temp_path)
            elif "f5" in active_engine:
                # Primary: F5-TTS, Secondary Fallback: OmniVoice
                success = synthesize_with_f5tts(spoken_text, voice_sample_path, voice_sample_text, temp_path)
                if not success:
                    print("F5-TTS failed or uninitialized. Falling back to OmniVoice...")
                    success = synthesize_with_omnivoice(spoken_text, voice_sample_path, voice_sample_text, temp_path)

            if success and os.path.exists(temp_path) and os.path.getsize(temp_path) > 100:
                return FileResponse(temp_path, media_type="audio/wav", filename="cloned_response.wav")
            else:
                print(f"Zero-shot cloning did not produce audio. Falling back to preset '{voice_preset}'.")

        # 2. Preset Neural Voice Synthesis (Edge-TTS / gTTS)
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
    print(f"Starting TTS Service (Configured Engine: {TTS_ENGINE})...")
    uvicorn.run(app, host="0.0.0.0", port=8003)
