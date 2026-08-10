#!/bin/bash
# Master Startup Script for Multimodal Character AI System

echo "=========================================================="
echo " Launching Multimodal Character AI Services"
echo "=========================================================="

# Create background logs directory
mkdir -p logs

# 1. Start vLLM Engine
echo "[1/4] Starting vLLM Engine (Qwen2.5-VL) on Port 8001..."
bash services/start_vllm.sh > logs/vllm.log 2>&1 &

# 2. Start STT Service
echo "[2/4] Starting Faster-Whisper STT Service on Port 8002..."
python3 services/start_stt.py > logs/stt.log 2>&1 &

# 3. Start TTS Service
echo "[3/4] Starting F5-TTS / XTTSv2 Service on Port 8003..."
python3 services/start_tts.py > logs/tts.log 2>&1 &

# 4. Start FastAPI Backend Orchestrator
echo "[4/4] Starting FastAPI Orchestrator on Port 8000..."
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 > logs/backend.log 2>&1 &

echo "=========================================================="
echo " All services launched! Logs available in ./logs/"
echo " To connect from Windows 11 PC, run the SSH Tunnel command:"
echo " ssh -L 3000:localhost:3000 -L 8000:localhost:8000 root@<runpod-ip> -p <port>"
echo "=========================================================="
