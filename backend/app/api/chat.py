from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.context_manager import context_manager
from app.services.llm_service import llm_service

router = APIRouter(prefix="/api/chat", tags=["chat"])

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
    Passes assembled 3-tier context and multimodal images to LLM service.
    """
    try:
        formatted_messages = context_manager.build_prompt_payload(
            character_data=req.character_card,
            conversation_history=req.messages,
            story_summary=req.story_summary
        )

        assistant_text = await llm_service.generate_chat_completion(
            messages=formatted_messages,
            max_tokens=1024,
            temperature=0.7,
            top_p=0.9
        )

        if assistant_text is not None:
            return {
                "character_id": req.character_id,
                "message": {"role": "assistant", "content": assistant_text}
            }

        # Fallback response for offline / dev testing mode
        char_name = req.character_card.get("name", "Character")
        fallback_text = f"*{char_name} nods thoughtfully* Indeed. Let us explore this narrative further!"
        return {
            "character_id": req.character_id,
            "message": {"role": "assistant", "content": fallback_text}
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
