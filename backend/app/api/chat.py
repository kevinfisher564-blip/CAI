from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.context_manager import context_manager
from app.services.llm_service import llm_service

router = APIRouter(prefix="/api/chat", tags=["chat"])

class ChatMessage(BaseModel):
    role: str
    content: Any  # Can be str or multimodal list of dicts (text + image_url)
    sender: Optional[str] = None

class ChatRequest(BaseModel):
    character_id: str
    messages: List[Dict[str, Any]]
    story_summary: Optional[str] = None
    character_card: Dict[str, Any]
    scenario: Optional[Dict[str, Any]] = None
    room_characters: Optional[List[Dict[str, Any]]] = None

@router.post("/completions")
async def chat_completion(req: ChatRequest):
    """
    Generate completion for single-character or multi-character turns.
    Passes assembled 3-tier context, global scenario, and multimodal images to LLM service.
    """
    try:
        formatted_messages = context_manager.build_prompt_payload(
            character_data=req.character_card,
            conversation_history=req.messages,
            story_summary=req.story_summary,
            scenario_data=req.scenario,
            room_characters=req.room_characters
        )

        assistant_text = await llm_service.generate_chat_completion(
            messages=formatted_messages,
            max_tokens=1024,
            temperature=0.7,
            top_p=0.9
        )

        char_name = req.character_card.get("name", "Character")

        if assistant_text is not None:
            # Clean any repetitive name prefixes if model prepended it
            cleaned_text = assistant_text.strip()
            if cleaned_text.startswith(f"{char_name}:"):
                cleaned_text = cleaned_text[len(f"{char_name}:"):].strip()

            return {
                "character_id": req.character_id,
                "message": {
                    "role": "assistant",
                    "content": cleaned_text,
                    "sender": char_name
                }
            }

        # Fallback response for offline / dev testing mode
        fallback_text = f"*{char_name} nods thoughtfully* Indeed. Let us explore this narrative further!"
        return {
            "character_id": req.character_id,
            "message": {
                "role": "assistant",
                "content": fallback_text,
                "sender": char_name
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
