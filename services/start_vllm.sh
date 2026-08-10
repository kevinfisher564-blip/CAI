#!/bin/bash
# Start vLLM inference engine hosting Qwen2.5-VL on GPU (Port 8001)

MODEL_NAME="Qwen/Qwen2.5-VL-7B-Instruct"
PORT=8001
GPU_MEMORY_UTIL=0.48
MAX_MODEL_LEN=32768

echo "=========================================================="
echo " Starting vLLM Engine for Multimodal Character AI"
echo " Model: ${MODEL_NAME}"
echo " Port: ${PORT}"
echo " Context Limit: ${MAX_MODEL_LEN} tokens"
echo "=========================================================="

python3 -m vllm.entrypoints.openai.api_server \
    --model ${MODEL_NAME} \
    --port ${PORT} \
    --gpu-memory-utilization ${GPU_MEMORY_UTIL} \
    --max-model-len ${MAX_MODEL_LEN} \
    --trust-remote-code \
    --dtype bfloat16 \
    --kv-cache-dtype fp8
