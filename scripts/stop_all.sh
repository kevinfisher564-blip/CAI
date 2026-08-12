#!/bin/bash
# Master Shutdown Script for Multimodal Character AI System

echo "=========================================================="
echo " Stopping Multimodal Character AI Services..."
echo "=========================================================="

PORTS=(8000 8001 9001 8002 8003)

for PORT in "${PORTS[@]}"; do
    echo "Stopping service listening on port ${PORT}..."
    if command -v fuser >/dev/null 2>&1; then
        fuser -k "${PORT}/tcp" 2>/dev/null || true
    elif command -v lsof >/dev/null 2>&1; then
        lsof -ti :"${PORT}" | xargs -r kill -9 2>/dev/null || true
    fi
done

echo "Ensuring all related background processes are terminated..."
pkill -9 -f "services/start_vllm.sh" 2>/dev/null || true
pkill -9 -f "vllm.entrypoints" 2>/dev/null || true
pkill -9 -f "services/start_stt.py" 2>/dev/null || true
pkill -9 -f "services/start_tts.py" 2>/dev/null || true
pkill -9 -f "backend.main:app" 2>/dev/null || true
pkill -9 -f "vite" 2>/dev/null || true

echo "=========================================================="
echo " All services stopped."
echo "=========================================================="
