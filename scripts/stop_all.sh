#!/bin/bash
# Master Shutdown Script for Multimodal Character AI System
# Thoroughly terminates services, kills orphaned worker processes, and frees GPU VRAM.

echo "=========================================================="
echo " Stopping Multimodal Character AI Services & Freeing GPU..."
echo "=========================================================="

PORTS=(8000 8001 9001 8002 8003 3000)

for PORT in "${PORTS[@]}"; do
    echo "Stopping service listening on port ${PORT}..."
    if command -v fuser >/dev/null 2>&1; then
        fuser -k -9 "${PORT}/tcp" 2>/dev/null || true
    elif command -v lsof >/dev/null 2>&1; then
        lsof -ti :"${PORT}" | xargs -r kill -9 2>/dev/null || true
    fi
done

echo "Terminating application background processes and workers..."
pkill -9 -f "services/start_vllm.sh" 2>/dev/null || true
pkill -9 -f "vllm" 2>/dev/null || true
pkill -9 -f "services/start_stt.py" 2>/dev/null || true
pkill -9 -f "services/start_tts.py" 2>/dev/null || true
pkill -9 -f "backend.main:app" 2>/dev/null || true
pkill -9 -f "uvicorn" 2>/dev/null || true
pkill -9 -f "faster_whisper" 2>/dev/null || true
pkill -9 -f "f5_tts" 2>/dev/null || true
pkill -9 -f "omnivoice" 2>/dev/null || true
pkill -9 -f "vite" 2>/dev/null || true

# Kill any lingering compute processes actively holding GPU device memory
if command -v nvidia-smi >/dev/null 2>&1; then
    echo "Checking for remaining GPU compute processes..."
    GPU_PIDS=$(nvidia-smi --query-compute-apps=pid --format=csv,noheader 2>/dev/null | tr -d '\r' | xargs)
    if [ -n "$GPU_PIDS" ]; then
        echo "Killing lingering GPU compute processes (PIDs: $GPU_PIDS)..."
        echo "$GPU_PIDS" | xargs -r kill -9 2>/dev/null || true
        sleep 1
    fi
fi

# Release any remaining CUDA device node file handles
if command -v fuser >/dev/null 2>&1; then
    fuser -k -9 /dev/nvidia* /dev/nvidia-uvm /dev/nvidia-modeset 2>/dev/null || true
fi

# Clear PyTorch CUDA allocator cache and IPC memory
if command -v python3 >/dev/null 2>&1; then
    python3 -c "
try:
    import torch
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.ipc_collect()
except Exception:
    pass
" 2>/dev/null || true
fi

sleep 1

echo "=========================================================="
echo " All services stopped and GPU memory released."
if command -v nvidia-smi >/dev/null 2>&1; then
    echo " Current GPU VRAM Status:"
    nvidia-smi --query-gpu=index,name,memory.used,memory.free,memory.total --format=csv,noheader 2>/dev/null | while IFS=, read -r idx name used free total; do
        echo "  GPU $idx ($name): Used:${used} | Free:${free} | Total:${total}"
    done
fi
echo "=========================================================="

