import os
import httpx
from typing import List, Dict, Any, Optional

class LLMService:
    """
    LLM Service for communicating with OpenAI-compatible API endpoints (e.g., vLLM, Ollama, LocalAI).
    Decouples callers from specific model names and infrastructure specifics.
    Auto-discovers the active loaded model via GET /v1/models.
    """

    def __init__(self, base_url: Optional[str] = None):
        raw_url = base_url or os.getenv("VLLM_BASE_URL") or os.getenv("VLLM_API_URL", "http://127.0.0.1:9001")
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
        return os.getenv("VLLM_MODEL_NAME", "default")

    async def generate_chat_completion(
        self,
        messages: List[Dict[str, Any]],
        max_tokens: int = 1024,
        temperature: float = 0.7,
        top_p: float = 0.9,
        min_p: Optional[float] = None,
        repetition_penalty: Optional[float] = None,
        model: Optional[str] = None,
        timeout: float = 60.0
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
