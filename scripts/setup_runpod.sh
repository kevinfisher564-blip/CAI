#!/bin/bash
# Master RunPod Setup Script for Multimodal Character AI System

set -e

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

# 2. Set up Python Environment & Install Dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt
pip install vllm faster-whisper f5-tts edge-tts gTTS "huggingface_hub[cli]"

# 3. Configure Hugging Face CLI & Token Authentication
export HF_HOME="/workspace/huggingface-cache"
mkdir -p ${HF_HOME}

echo "=========================================================="
echo " Hugging Face Authentication"
echo "=========================================================="

if [ -n "${HF_TOKEN}" ]; then
    echo "HF_TOKEN detected in environment. Logging into Hugging Face CLI..."
    hf auth token
else
    echo "Tip: You can pass your token via HF_TOKEN environment variable:"
    echo "     export HF_TOKEN='hf_your_token_here'"
    echo "Checking if already logged into Hugging Face..."
    hf whoami || true
fi

# 4. Pre-download Model Weights via Hugging Face CLI (Multi-threaded fast download)
echo "=========================================================="
echo " Pre-downloading Model Weights via Hugging Face CLI"
echo "=========================================================="

echo "[1/2] Pre-downloading Qwen2.5-VL-7B-Instruct..."
hf download Qwen/Qwen2.5-VL-7B-Instruct --cache-dir ${HF_HOME}

echo "[2/2] Pre-downloading Faster-Whisper large-v3-turbo..."
hf download deepdml/faster-whisper-large-v3-turbo-ct2 --cache-dir ${HF_HOME}

echo "=========================================================="
echo " RunPod Environment Setup Complete!"
echo " Run './scripts/start_all.sh' to launch all service engines."
echo "=========================================================="
