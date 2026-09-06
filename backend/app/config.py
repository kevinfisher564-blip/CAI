import os

# Centralized Default LLM Sampling Hyperparameters
DEFAULT_TEMPERATURE: float = float(os.getenv("DEFAULT_TEMPERATURE", "0.6"))
DEFAULT_TOP_P: float = float(os.getenv("DEFAULT_TOP_P", "0.85"))
DEFAULT_MIN_P: float = float(os.getenv("DEFAULT_MIN_P", "0.0"))
DEFAULT_REPETITION_PENALTY: float = float(os.getenv("DEFAULT_REPETITION_PENALTY", "1.05"))
DEFAULT_MAX_TOKENS: int = int(os.getenv("DEFAULT_MAX_TOKENS", "1024"))

# LLM Endpoint & Network Configuration
DEFAULT_VLLM_URL: str = os.getenv("VLLM_BASE_URL") or os.getenv("VLLM_API_URL", "http://127.0.0.1:9001")
DEFAULT_MODEL_NAME: str = os.getenv("VLLM_MODEL_NAME", "default")
DEFAULT_LLM_TIMEOUT: float = float(os.getenv("LLM_TIMEOUT", "60.0"))
