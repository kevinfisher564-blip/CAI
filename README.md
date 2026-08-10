# Local Multimodal Character AI Studio

A self-hosted, local implementation of a **Character AI alternative** running on **RunPod GPU instances (RTX 6000 48GB / 80-96GB VRAM)** and accessed securely from a **Windows 11 PC** via an SSH tunnel.

---

## Features
- **Multimodal Text & Vision Chat**: Powered by `Qwen2.5-VL-7B-Instruct` via vLLM with high-quality roleplay and image comprehension.
- **Zero-Shot Voice Cloning & Presets**: Custom 3–10s WAV audio reference voice cloning via `F5-TTS` / `XTTSv2`, with default fallback preset voices.
- **Faster-Whisper STT**: Real-time microphone audio transcription.
- **In-App Visual Character Editor**: Create, edit, and export Tavern Spec v2 character cards, personality guidelines, system prompts, and voice samples.
- **3-Tier Context Architecture**: Native 32k–64k vLLM window, automatic story chapter summarization, and vector lorebook retrieval for long-running stories.
- **Encrypted SSH Tunneling**: End-to-end SSH encrypted traffic between Windows 11 and RunPod.

---

## Quickstart & Launch Instructions

### 1. Bootstrapping on RunPod Instance
Clone this repository to your RunPod workspace directory and export your Hugging Face token:
```bash
cd /workspace
git clone https://github.com/your-username/KRF-CAI.git
cd KRF-CAI

# (Optional but recommended) Export your Hugging Face Token for fast CLI downloads
export HF_TOKEN="hf_your_token_here"

bash scripts/setup_runpod.sh
```

### 2. Launching All Services on RunPod
To launch vLLM (8001), STT (8002), TTS (8003), and FastAPI Backend (8000) simultaneously:
```bash
bash scripts/start_all.sh
```

### 3. Connecting from Windows 11 PC via SSH Tunnel
On your Windows 11 PC, run `scripts\tunnel.bat` or execute in PowerShell:
```powershell
ssh -N -L 3000:localhost:3000 -L 8000:localhost:8000 root@<YOUR_RUNPOD_IP> -p <YOUR_RUNPOD_SSH_PORT>
```

Open your browser at `http://localhost:3000` to start chatting with your pre-defined and custom characters!
