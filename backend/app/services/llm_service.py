import os
import re
import httpx
from typing import List, Dict, Any, Optional
from app.config import (
    DEFAULT_TEMPERATURE,
    DEFAULT_TOP_P,
    DEFAULT_MIN_P,
    DEFAULT_REPETITION_PENALTY,
    DEFAULT_MAX_TOKENS,
    DEFAULT_VLLM_URL,
    DEFAULT_MODEL_NAME,
    DEFAULT_LLM_TIMEOUT,
)

def clean_to_pure_dialogue(text: Optional[str], char_name: Optional[str] = None) -> str:
    """
    Strips narrative prose, asterisk/parenthetical actions, stage directions,
    and third-person attribution prefixes to return pure spoken dialogue.
    """
    if not text:
        return ""

    cleaned = text

    # Remove text wrapped in asterisks (e.g. *smiles*, **nods**, ***actions***)
    cleaned = re.sub(r'\*+[^*]+\*+', '', cleaned)

    # Remove text wrapped in parentheses or brackets (stage directions/actions)
    cleaned = re.sub(r'\([^)]*\)', '', cleaned)
    cleaned = re.sub(r'\[[^\]]*\]', '', cleaned)

    # If character name is provided, strip 3rd person narrative prefixes/actions
    if char_name:
        escaped_name = re.escape(char_name)
        # Prefix with colon: "Alice: " or "{{char}}:"
        cleaned = re.sub(rf'^(?:{escaped_name}|{{{{char}}}})\s*:\s*', '', cleaned, flags=re.IGNORECASE)
        # Speech verbs: "Alice says, " / "Alice replies: "
        cleaned = re.sub(
            rf'^(?:{escaped_name}|{{{{char}}}})\s+(?:says|replies|shouts|whispers|speaks|mutters|exclaims|screams|laughs),?\s*',
            '',
            cleaned,
            flags=re.IGNORECASE
        )
        # 3rd person narrative sentence starting with char name (e.g. "Alice gives you an angry stare and loudly slams the door. What do you want?")
        cleaned = re.sub(
            rf'^(?:{escaped_name}|{{{{char}}}})\s+[a-zA-Z0-9\s,\'\"]+?(?:\.|\n)\s*',
            '',
            cleaned,
            flags=re.IGNORECASE
        )

    # Remove any generic {{char}} macro leftover in the text
    cleaned = re.sub(r'\{\{char\}\}', char_name if char_name else '', cleaned, flags=re.IGNORECASE)

    # Normalize whitespace and line breaks
    cleaned = re.sub(r'[ \t]+', ' ', cleaned)
    cleaned = re.sub(r'\n\s*\n+', '\n', cleaned).strip()

    # Strip surrounding quotation marks if the entire response was wrapped in quotes
    if (cleaned.startswith('"') and cleaned.endswith('"')) or (cleaned.startswith("'") and cleaned.endswith("'")):
        cleaned = cleaned[1:-1].strip()

    # If aggressive stripping removed everything (e.g. model ONLY produced *action*), fallback to original text without asterisks
    if not cleaned and text:
        cleaned = text.replace('*', '').replace('(', '').replace(')', '').strip()

    return cleaned

class LLMService:
    """
    LLM Service for communicating with OpenAI-compatible API endpoints (e.g., vLLM, Ollama, LocalAI).
    Decouples callers from specific model names and infrastructure specifics.
    Auto-discovers the active loaded model via GET /v1/models.
    """

    def __init__(self, base_url: Optional[str] = None):
        raw_url = base_url or DEFAULT_VLLM_URL
        # Normalize base URL (strip trailing paths like /v1/chat/completions if provided in env)
        if "/v1" in raw_url:
            self.base_url = raw_url.split("/v1")[0].rstrip("/")
        else:
            self.base_url = raw_url.rstrip("/")

        self._cached_model_name: Optional[str] = None

    async def get_active_model(self, client: Optional[httpx.AsyncClient] = None) -> str:
        """
        Dynamically retrieves the model name currently hosted by the engine via /v1/models.
        Caches the discovered model name for subsequent calls.
        """
        if self._cached_model_name:
            return self._cached_model_name

        models_endpoint = f"{self.base_url}/v1/models"
        
        async def _fetch(c: httpx.AsyncClient) -> Optional[str]:
            try:
                resp = await c.get(models_endpoint, timeout=5.0)
                if resp.status_code == 200:
                    data = resp.json().get("data", [])
                    if data and len(data) > 0:
                        return data[0].get("id")
            except Exception as e:
                print(f"[LLMService] Could not auto-detect model from {models_endpoint}: {e}")
            return None

        if client:
            detected = await _fetch(client)
        else:
            async with httpx.AsyncClient() as c:
                detected = await _fetch(c)

        if detected:
            self._cached_model_name = detected
            print(f"[LLMService] Auto-discovered active model: {self._cached_model_name}")
            return self._cached_model_name

        # Fallback to configured model name or generic alias
        return DEFAULT_MODEL_NAME

    async def generate_chat_completion(
        self,
        messages: List[Dict[str, Any]],
        max_tokens: int = DEFAULT_MAX_TOKENS,
        temperature: float = DEFAULT_TEMPERATURE,
        top_p: float = DEFAULT_TOP_P,
        min_p: Optional[float] = DEFAULT_MIN_P,
        repetition_penalty: Optional[float] = DEFAULT_REPETITION_PENALTY,
        model: Optional[str] = None,
        timeout: float = DEFAULT_LLM_TIMEOUT
    ) -> Optional[str]:
        """
        Sends chat completion request to the OpenAI-compatible endpoint.
        Supports per-character temperature, top_p, min_p, repetition_penalty, and max_tokens parameters.
        Returns the generated assistant text content, or None if unavailable.
        """
        endpoint = f"{self.base_url}/v1/chat/completions"

        async with httpx.AsyncClient(timeout=timeout) as client:
            # Resolve model dynamically if not explicitly specified
            model_name = model or await self.get_active_model(client)

            payload = {
                "model": model_name,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "top_p": top_p
            }
            if min_p is not None and min_p > 0:
                payload["min_p"] = min_p
            if repetition_penalty is not None and repetition_penalty > 0:
                payload["repetition_penalty"] = repetition_penalty

            try:
                response = await client.post(endpoint, json=payload)
                if response.status_code == 200:
                    res_json = response.json()
                    return res_json["choices"][0]["message"]["content"]
                else:
                    print(f"[LLMService Warning] HTTP Status {response.status_code}: {response.text}")
                    # Invalidate model cache in case the model changed or unloaded
                    self._cached_model_name = None
            except Exception as e:
                print(f"[LLMService Connection Error] Could not connect to LLM at {endpoint}: {e}")
                self._cached_model_name = None

        return None

# Singleton instance
llm_service = LLMService()
