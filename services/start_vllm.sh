#!/bin/bash
# Start vLLM inference engine hosting selected model on GPU (Port 9001)

PORT=${PORT:-9001}
GPU_MEMORY_UTIL=${GPU_MEMORY_UTIL:-0.48}
MAX_MODEL_LEN=${MAX_MODEL_LEN:-32768}

# Disable FlashInfer sampler to prevent JIT sampling compilation errors
export VLLM_USE_FLASHINFER_SAMPLER=0

# Clean stale torch/triton compile cache to avoid cubin reload warnings across model switches
rm -rf ~/.cache/vllm/torch_compile_cache /root/.cache/vllm/torch_compile_cache 2>/dev/null || true

# Function to discover available models from Hugging Face cache and /workspace/models
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

# 1. Check if model name passed via argument ($1) or environment ($MODEL_NAME)
SELECTED_MODEL=""
if [ -n "$1" ]; then
    SELECTED_MODEL="$1"
elif [ -n "$MODEL_NAME" ]; then
    SELECTED_MODEL="$MODEL_NAME"
fi

# 2. Interactive selection fallback if running standalone without arguments
if [ -z "$SELECTED_MODEL" ]; then
    # Determine input stream for interactive prompt
    input_source=""
    if [ -t 0 ]; then
        input_source=""
    elif [ -e /dev/tty ] && [ -r /dev/tty ]; then
        input_source="/dev/tty"
    fi

    if [ -n "$input_source" ] || [ -t 0 ]; then
        echo "=========================================================="
        echo " Scanning for available models in Hugging Face Cache & Workspace..."
        echo "=========================================================="

        mapfile -t AVAILABLE_MODELS < <(get_available_models)
        num_models=${#AVAILABLE_MODELS[@]}

        if [ "$num_models" -gt 0 ]; then
            echo "Found the following cached / local models:"
            for i in "${!AVAILABLE_MODELS[@]}"; do
                echo "  [$((i + 1))] ${AVAILABLE_MODELS[$i]}"
            done
            echo "  [$((num_models + 1))] Enter custom path or Hugging Face model ID"
            prompt_msg="Select model [1-$((num_models + 1))] (Default: 1): "
        else
            echo "No cached models found automatically."
            echo "  [1] Enter custom path or Hugging Face model ID"
            prompt_msg="Enter custom model path or Hugging Face repo ID: "
        fi
        echo "=========================================================="

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
            SELECTED_MODEL="$choice"
        fi
    fi
fi

# Fallback default if nothing selected
MODEL_NAME="${SELECTED_MODEL:-mistralai/Pixtral-12B-2409}"

echo "=========================================================="
echo " Starting vLLM Engine for Multimodal Character AI"
echo " Model: ${MODEL_NAME}"
echo " Port: ${PORT}"
echo " Context Limit: ${MAX_MODEL_LEN} tokens"
echo " FlashInfer Sampler Disabled: TRUE"
echo "=========================================================="

exec python3 -m vllm.entrypoints.openai.api_server \
    --model "${MODEL_NAME}" \
    --port "${PORT}" \
    --gpu-memory-utilization "${GPU_MEMORY_UTIL}" \
    --max-model-len "${MAX_MODEL_LEN}" \
    --trust-remote-code \
    --dtype bfloat16 \
    --kv-cache-dtype auto
