#!/bin/bash
# Master RunPod Setup Script for Multimodal Character AI System

set -e

# Auto-load environment variables from .env if present
if [ -f .env ]; then
    echo "Loading environment variables from .env..."
    set -a
    source .env
    set +a
elif [ -f /workspace/.env ]; then
    echo "Loading environment variables from /workspace/.env..."
    set -a
    source /workspace/.env
    set +a
fi

echo "=========================================================="
echo " Bootstrapping RunPod GPU Workspace Environment"
echo "=========================================================="

# 1. Install System Packages
apt-get update && apt-get install -y \
    ffmpeg \
    git \
    curl \
    wget \
    build-essential \
    libsndfile1 \
    psmisc \
    lsof \
    nodejs \
    npm

# 2. Set up Python Environment & Fast Package Installer (uv)
export PIP_CACHE_DIR="/workspace/.cache/pip"
export UV_CACHE_DIR="/workspace/.cache/uv"
mkdir -p ${PIP_CACHE_DIR} ${UV_CACHE_DIR}

echo "Installing uv ultra-fast package installer..."
pip install --upgrade pip uv

echo "Installing backend dependencies with CUDA index alignment..."
uv pip install --system \
    --extra-index-url https://download.pytorch.org/whl/cu128 \
    -r backend/requirements.txt || pip install --extra-index-url https://download.pytorch.org/whl/cu128 -r backend/requirements.txt


# 3. Configure Hugging Face CLI & Token Authentication
export HF_HOME="/workspace/huggingface-cache"
mkdir -p ${HF_HOME}

echo "=========================================================="
echo " Hugging Face Authentication"
echo "=========================================================="

if [ -n "${HF_TOKEN}" ]; then
    echo "HF_TOKEN detected in environment. Logging into Hugging Face CLI..."
    hf auth login --token "${HF_TOKEN}"
else
    echo "Tip: You can pass your token via HF_TOKEN environment variable:"
    echo "     export HF_TOKEN='hf_your_token_here'"
    echo "Checking if already logged into Hugging Face..."
    hf auth whoami || true
fi

# 4. Pre-download Model Weights via Hugging Face CLI (Multi-threaded fast download)
echo "=========================================================="
echo " Pre-downloading Model Weights via Hugging Face CLI"
echo "=========================================================="

#echo "[1/4] Pre-downloading Qwen2.5-VL-7B-Instruct..."
#hf download Qwen/Qwen2.5-VL-7B-Instruct --cache-dir ${HF_HOME}

echo "[1/4] Pre-downloading Qwen2.5-VL-7B-Instruct Abliterated..."
mkdir -p /workspace/models/qwen3-vl-8b-abliterated
hf download wangkanai/qwen3-vl-8b-instruct \
    qwen3-vl-8b-instruct-abliterated.safetensors \
    --local-dir /workspace/models/qwen3-vl-8b-abliterated

hf download Qwen/Qwen3-VL-8B-Instruct \
    config.json \
    generation_config.json \
    preprocessor_config.json \
    video_preprocessor_config.json \
    tokenizer.json \
    tokenizer_config.json \
    vocab.json \
    merges.txt \
    --local-dir /workspace/models/qwen3-vl-8b-abliterated

echo "[2/4] Pre-downloading Pixtral-12B-2409..."
hf download mistralai/Pixtral-12B-2409 --cache-dir ${HF_HOME}    
        
echo "[3/4] Pre-downloading Faster-Whisper large-v3-turbo..."
hf download deepdml/faster-whisper-large-v3-turbo-ct2 --cache-dir ${HF_HOME}

echo "[4/4] Pre-downloading OmniVoice zero-shot TTS model..."
hf download k2-fsa/OmniVoice --cache-dir ${HF_HOME} || true

# 5. (Optional) Clone External Assets Repository (Characters, Voices, Scenarios)
if [ -n "${ASSETS_REPO_URL}" ] || [ -n "${ASSETS_REPO}" ]; then
    REPO_URL="${ASSETS_REPO_URL:-$ASSETS_REPO}"
    TARGET_DIR="${ASSETS_DIR:-/workspace/cai-assets}"
    echo "=========================================================="
    echo " Setting up External Assets Repository: ${REPO_URL}"
    echo "=========================================================="
    if [ -d "${TARGET_DIR}/.git" ]; then
        echo "Updating existing assets repository in ${TARGET_DIR}..."
        (cd "${TARGET_DIR}" && git pull) || true
    else
        git clone "${REPO_URL}" "${TARGET_DIR}"
    fi
    echo "Assets cloned to ${TARGET_DIR}."
fi

echo "=========================================================="
echo " RunPod Environment Setup Complete!"
echo " Run './scripts/start_all.sh' to launch all service engines."
echo "=========================================================="
