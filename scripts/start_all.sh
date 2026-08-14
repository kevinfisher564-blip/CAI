#!/bin/bash
# Master Startup Script for Multimodal Character AI System

echo "=========================================================="
echo " Launching Multimodal Character AI Services"
echo "=========================================================="

# Create background logs directory
mkdir -p logs

# 1. Start vLLM Engine
echo "[1/5] Starting vLLM Engine (Qwen2.5-VL) on Port 9001..."
bash services/start_vllm.sh > logs/vllm.log 2>&1 &

# 2. Start STT Service
echo "[2/5] Starting Faster-Whisper STT Service on Port 8002..."
python3 services/start_stt.py > logs/stt.log 2>&1 &

# 3. Start TTS Service
echo "[3/5] Starting F5-TTS / XTTSv2 Service on Port 8003..."
python3 services/start_tts.py > logs/tts.log 2>&1 &

# 4. Start FastAPI Backend Orchestrator
echo "[4/5] Starting FastAPI Orchestrator on Port 8000..."
PYTHONPATH=backend python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 > logs/backend.log 2>&1 &

# 5. Start React Vite Frontend Web UI (if node/npm is installed)
if command -v npm >/dev/null 2>&1; then
    echo "[5/5] Starting React Frontend Web UI on Port 3000..."
    (cd frontend && npm install --no-audit && npm run dev -- --host 0.0.0.0 --port 3000) > ../logs/frontend.log 2>&1 &
else
    echo "[5/5] Skipping frontend on RunPod (npm not found). Run 'apt-get update && apt-get install -y nodejs npm' or run frontend on Windows PC."
fi

echo "=========================================================="
echo " All services launched! Logs available in ./logs/"
echo " To stop services, run './scripts/stop_all.sh'"
echo " To connect from Windows 11 PC, run the SSH Tunnel command:"
echo " ssh -i ~/.ssh/id_ed25519 -N -L 3000:127.0.0.1:3000 -L 8000:127.0.0.1:8000 root@<runpod-ip> -p <port>"
echo "=========================================================="
