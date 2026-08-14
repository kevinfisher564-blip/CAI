#!/bin/bash
# Start vLLM inference engine hosting Qwen2.5-VL on GPU (Port 8001)

MODEL_NAME="/workspace/models/qwen3-vl-8b-abliterated"
PORT=9001
GPU_MEMORY_UTIL=0.48
MAX_MODEL_LEN=32768

# Disable FlashInfer sampler to prevent JIT sampling compilation errors
export VLLM_USE_FLASHINFER_SAMPLER=0

echo "=========================================================="
echo " Starting vLLM Engine for Multimodal Character AI"
echo " Model: ${MODEL_NAME}"
echo " Port: ${PORT}"
echo " Context Limit: ${MAX_MODEL_LEN} tokens"
echo " FlashInfer Sampler Disabled: TRUE"
echo "=========================================================="

python3 -m vllm.entrypoints.openai.api_server \
    --model ${MODEL_NAME} \
    --port ${PORT} \
    --gpu-memory-utilization ${GPU_MEMORY_UTIL} \
    --max-model-len ${MAX_MODEL_LEN} \
    --trust-remote-code \
    --dtype bfloat16 \
    --kv-cache-dtype auto
