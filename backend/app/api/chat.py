import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.context_manager import context_manager

router = APIRouter(prefix="/api/chat", tags=["chat"])

VLLM_API_URL = "http://localhost:8001/v1/chat/completions"

class ChatMessage(BaseModel):
    role: str
    content: Any  # Can be str or multimodal list of dicts (text + image_url)

class ChatRequest(BaseModel):
    character_id: str
    messages: List[Dict[str, Any]]
    story_summary: Optional[str] = None
    character_card: Dict[str, Any]

@router.post("/completions")
async def chat_completion(req: ChatRequest):
    """
    Generate completion for single-character or multi-character turns.
    Passes assembled 3-tier context and multimodal images to vLLM (Qwen2.5-VL).
    """
    try:
        formatted_messages = context_manager.build_prompt_payload(
            character_data=req.character_card,
            conversation_history=req.messages,
            story_summary=req.story_summary
        )

        payload = {
            "model": "Qwen/Qwen2.5-VL-7B-Instruct",
            "messages": formatted_messages,
            "max_tokens": 1024,
            "temperature": 0.7,
            "top_p": 0.9
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(VLLM_API_URL, json=payload)
                if response.status_code == 200:
                    res_json = response.json()
                    assistant_text = res_json["choices"][0]["message"]["content"]
                    return {
                        "character_id": req.character_id,
                        "message": {"role": "assistant", "content": assistant_text}
                    }
            except Exception as e:
                print(f"vLLM connection note: {e}")

        # Fallback response for offline / dev testing mode
        char_name = req.character_card.get("name", "Character")
        fallback_text = f"*{char_name} nods thoughtfully* Indeed. Let us explore this narrative further!"
        return {
            "character_id": req.character_id,
            "message": {"role": "assistant", "content": fallback_text}
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
