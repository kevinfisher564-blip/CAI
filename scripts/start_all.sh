#!/bin/bash
# Master Startup Script for Multimodal Character AI System

echo "=========================================================="
echo " Multimodal Character AI - Master Launcher"
echo "=========================================================="

# Function to discover available models from Hugging Face cache and workspace
get_available_models() {
    python3 - <<'EOF'
import os

models = []

# 1. Hugging Face Cache directories
hf_home = os.environ.get("HF_HOME")
hf_cache_dirs = [
    os.path.join(hf_home, "hub") if hf_home else None,
    hf_home,
    os.path.expanduser("~/.cache/huggingface/hub"),
    os.path.expanduser("~/.cache/huggingface")
]

for cache_dir in filter(None, hf_cache_dirs):
    if os.path.isdir(cache_dir):
        try:
            for d in os.listdir(cache_dir):
                if d.startswith("models--"):
                    parts = d[len("models--"):].split("--")
                    repo_id = "/".join(parts)
                    if repo_id not in models:
                        models.append(repo_id)
        except Exception:
            pass

# 2. Local workspace models directories
for local_root in ["/workspace/models", "./models"]:
    if os.path.isdir(local_root):
        try:
            for d in os.listdir(local_root):
                full_p = os.path.abspath(os.path.join(local_root, d))
                if os.path.isdir(full_p) and full_p not in models:
                    models.append(full_p)
        except Exception:
            pass

for m in models:
    print(m)
EOF
}

# Allow passing model name via argument ($1) or environment ($MODEL_NAME)
SELECTED_MODEL=""
if [ -n "$1" ]; then
    SELECTED_MODEL="$1"
elif [ -n "$MODEL_NAME" ]; then
    SELECTED_MODEL="$MODEL_NAME"
fi

if [ -z "$SELECTED_MODEL" ]; then
    echo " Scanning for available LLM models in Hugging Face Cache & Workspace..."
    echo "----------------------------------------------------------"

    # Read discovered models into array
    mapfile -t AVAILABLE_MODELS < <(get_available_models)
    num_models=${#AVAILABLE_MODELS[@]}

    if [ "$num_models" -gt 0 ]; then
        echo "Found the following cached / local models:"
        for i in "${!AVAILABLE_MODELS[@]}"; do
            echo "  [$((i + 1))] ${AVAILABLE_MODELS[$i]}"
        done
        echo "  [$((num_models + 1))] Enter custom path or Hugging Face model ID"
    else
        echo "No cached models found automatically."
        echo "  [1] Enter custom path or Hugging Face model ID"
    fi
    echo "----------------------------------------------------------"

    # Determine input stream for interactive prompt
    input_source=""
    if [ -t 0 ]; then
        input_source=""
    elif [ -e /dev/tty ] && [ -r /dev/tty ]; then
        input_source="/dev/tty"
    fi

    if [ -n "$input_source" ] || [ -t 0 ]; then
        if [ "$num_models" -gt 0 ]; then
            prompt_msg="Select model [1-$((num_models + 1))] (Default: 1): "
        else
            prompt_msg="Enter custom model path or Hugging Face repo ID: "
        fi

        if [ -n "$input_source" ]; then
            read -r -p "$prompt_msg" choice < "$input_source"
        else
            read -r -p "$prompt_msg" choice
        fi

        choice=$(echo "$choice" | xargs)

        if [ -z "$choice" ] && [ "$num_models" -gt 0 ]; then
            SELECTED_MODEL="${AVAILABLE_MODELS[0]}"
        elif [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "$num_models" ]; then
            idx=$((choice - 1))
            SELECTED_MODEL="${AVAILABLE_MODELS[$idx]}"
        elif [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -eq "$((num_models + 1))" ]; then
            if [ -n "$input_source" ]; then
                read -r -p "Enter custom model path or Hugging Face repo ID: " custom_input < "$input_source"
            else
                read -r -p "Enter custom model path or Hugging Face repo ID: " custom_input
            fi
            SELECTED_MODEL=$(echo "$custom_input" | xargs)
        elif [ -n "$choice" ]; then
            # User typed a direct path or model ID instead of a number
            SELECTED_MODEL="$choice"
        fi
    fi
fi

# Fallback default if nothing selected
SELECTED_MODEL="${SELECTED_MODEL:-mistralai/Pixtral-12B-2409}"

# 2. Select TTS Engine (OmniVoice vs F5-TTS vs Edge-TTS)
SELECTED_TTS_ENGINE=""
if [ -n "$2" ]; then
    SELECTED_TTS_ENGINE="$2"
elif [ -n "$TTS_ENGINE" ]; then
    SELECTED_TTS_ENGINE="$TTS_ENGINE"
fi

if [ -z "$SELECTED_TTS_ENGINE" ]; then
    if [ -n "$input_source" ] || [ -t 0 ]; then
        echo "----------------------------------------------------------"
        echo " Select Speech Synthesis (TTS) Engine for Audio Output:"
        echo "  [1] OmniVoice (k2-fsa/OmniVoice - Multilingual 600+ Zero-Shot)"
        echo "  [2] F5-TTS (SWivid/F5-TTS - Flow-Matching Zero-Shot)"
        echo "  [3] Edge-TTS (Microsoft Neural Presets - 0 MB GPU VRAM)"
        echo "----------------------------------------------------------"
        tts_prompt="Select TTS Engine [1-3] (Default: 1): "

        if [ -n "$input_source" ]; then
            read -r -p "$tts_prompt" tts_choice < "$input_source"
        else
            read -r -p "$tts_prompt" tts_choice
        fi

        tts_choice=$(echo "$tts_choice" | xargs)
        if [ "$tts_choice" = "2" ] || [ "$tts_choice" = "f5" ] || [ "$tts_choice" = "f5-tts" ]; then
            SELECTED_TTS_ENGINE="f5_tts"
        elif [ "$tts_choice" = "3" ] || [ "$tts_choice" = "edge" ] || [ "$tts_choice" = "edge-tts" ]; then
            SELECTED_TTS_ENGINE="edge_tts"
        else
            SELECTED_TTS_ENGINE="omnivoice"
        fi
    fi
fi

SELECTED_TTS_ENGINE="${SELECTED_TTS_ENGINE:-omnivoice}"

echo " Selected LLM: ${SELECTED_MODEL}"
echo " Selected TTS: ${SELECTED_TTS_ENGINE}"
echo " STT Engine:   Faster-Whisper (Port 8002)"
echo "=========================================================="

# Ensure previous instances and GPU allocations are cleanly stopped and freed
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/stop_all.sh" ]; then
    echo " Purging previous instances and reclaiming GPU VRAM before startup..."
    bash "${SCRIPT_DIR}/stop_all.sh"
    echo ""
fi

# Create background logs directory
mkdir -p logs

# 1. Start vLLM Engine in background with chosen model
echo "[1/5] Starting vLLM Engine on Port 9001 (Model: ${SELECTED_MODEL})..."
bash services/start_vllm.sh "${SELECTED_MODEL}" > logs/vllm.log 2>&1 &

# 2. Start STT Service (Faster-Whisper)
echo "[2/5] Starting Faster-Whisper STT Service on Port 8002..."
python3 services/start_stt.py > logs/stt.log 2>&1 &

# 3. Start TTS Service (OmniVoice / F5-TTS / Edge-TTS)
echo "[3/5] Starting TTS Service on Port 8003 (Engine: ${SELECTED_TTS_ENGINE})..."
TTS_ENGINE="${SELECTED_TTS_ENGINE}" python3 services/start_tts.py > logs/tts.log 2>&1 &

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
