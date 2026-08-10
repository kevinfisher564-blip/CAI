import os
import tempfile
import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException
from faster_whisper import WhisperModel

app = FastAPI(title="Faster-Whisper STT Service")

# Initialize Whisper model on GPU with float16
MODEL_SIZE = os.getenv("WHISPER_MODEL", "large-v3-turbo")
print(f"Loading Faster-Whisper model: {MODEL_SIZE} on CUDA...")
stt_model = WhisperModel(MODEL_SIZE, device="cuda", compute_type="float16")
print("Faster-Whisper STT service initialized!")

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        suffix = os.path.splitext(file.filename)[1] if file.filename else ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name

        segments, info = stt_model.transcribe(temp_path, beam_size=5, language="en")
        text = " ".join([segment.text for segment in segments]).strip()

        os.remove(temp_path)
        return {"text": text, "language": info.language, "duration": info.duration}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)
