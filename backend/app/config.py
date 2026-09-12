import os
from typing import List, Optional

# Attempt to load .env from repository root or current directory
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_ROOT = os.path.dirname(BACKEND_DIR)

try:
    from dotenv import load_dotenv
    # Check repo root and workspace
    if os.path.exists(os.path.join(REPO_ROOT, ".env")):
        load_dotenv(os.path.join(REPO_ROOT, ".env"))
    elif os.path.exists(os.path.join(BACKEND_DIR, ".env")):
        load_dotenv(os.path.join(BACKEND_DIR, ".env"))
    elif os.path.exists("/workspace/.env"):
        load_dotenv("/workspace/.env")
    else:
        load_dotenv()
except ImportError:
    pass

def resolve_dir_path(env_keys: List[str], default_path: str) -> str:
    """Resolve an absolute path from a list of environment variable aliases, falling back to a default."""
    for key in env_keys:
        val = os.getenv(key)
        if val and val.strip():
            expanded = os.path.expanduser(val.strip())
            return os.path.abspath(expanded)
    return os.path.abspath(os.path.expanduser(default_path))

# Root Asset Directory (optional top-level directory containing characters/, voices/, scenarios/)
ASSETS_DIR: Optional[str] = None
raw_assets_dir = os.getenv("ASSETS_DIR") or os.getenv("ASSETS_PATH")
if raw_assets_dir and raw_assets_dir.strip():
    ASSETS_DIR = os.path.abspath(os.path.expanduser(raw_assets_dir.strip()))

# Characters Directory
_default_characters = (
    os.path.join(ASSETS_DIR, "characters")
    if ASSETS_DIR and os.path.isdir(os.path.join(ASSETS_DIR, "characters"))
    else (ASSETS_DIR if ASSETS_DIR and not os.path.exists(os.path.join(ASSETS_DIR, "characters")) and any(f.endswith(".json") for f in os.listdir(ASSETS_DIR) if os.path.isfile(os.path.join(ASSETS_DIR, f))) else (os.path.join(ASSETS_DIR, "characters") if ASSETS_DIR else os.path.join(BACKEND_DIR, "characters")))
)
CHARACTERS_DIR: str = resolve_dir_path(
    ["CHARACTERS_DIR", "CHARACTERS_PATH", "CHARACTER_DIR", "CHARACTER_PATH"],
    _default_characters
)

# Voices / Voice Samples Directory
_default_voices = (
    os.path.join(ASSETS_DIR, "voices")
    if ASSETS_DIR and os.path.isdir(os.path.join(ASSETS_DIR, "voices"))
    else (
        os.path.join(ASSETS_DIR, "voice_samples")
        if ASSETS_DIR and os.path.isdir(os.path.join(ASSETS_DIR, "voice_samples"))
        else (
            os.path.join(CHARACTERS_DIR, "voice_samples")
            if os.path.exists(os.path.join(CHARACTERS_DIR, "voice_samples")) or not ASSETS_DIR
            else (os.path.join(ASSETS_DIR, "voices") if ASSETS_DIR else os.path.join(CHARACTERS_DIR, "voice_samples"))
        )
    )
)
VOICES_DIR: str = resolve_dir_path(
    ["VOICES_DIR", "VOICES_PATH", "VOICE_DIR", "VOICE_PATH", "VOICE_SAMPLES_DIR", "VOICE_SAMPLES_PATH"],
    _default_voices
)

# Scenarios Directory
_default_scenarios = (
    os.path.join(ASSETS_DIR, "scenarios")
    if ASSETS_DIR and os.path.isdir(os.path.join(ASSETS_DIR, "scenarios"))
    else (os.path.join(ASSETS_DIR, "scenarios") if ASSETS_DIR else os.path.join(BACKEND_DIR, "scenarios"))
)
SCENARIOS_DIR: str = resolve_dir_path(
    ["SCENARIOS_DIR", "SCENARIOS_PATH", "SCENARIO_DIR", "SCENARIO_PATH"],
    _default_scenarios
)

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

