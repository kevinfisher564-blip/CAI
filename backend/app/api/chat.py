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

        # Extract per-character sampling hyperparameters
        char_card = req.character_card
        extensions = char_card.get("extensions") or {}
        
        raw_temp = char_card.get("temperature") if char_card.get("temperature") is not None else extensions.get("temperature", 0.7)
        raw_top_p = char_card.get("top_p") if char_card.get("top_p") is not None else extensions.get("top_p", 0.9)
        raw_min_p = char_card.get("min_p") if char_card.get("min_p") is not None else extensions.get("min_p", 0.0)
        raw_rep_pen = char_card.get("repetition_penalty") if char_card.get("repetition_penalty") is not None else extensions.get("repetition_penalty", 1.05)
        raw_max_tokens = char_card.get("max_tokens") or char_card.get("max_response_tokens") or extensions.get("max_tokens") or extensions.get("max_response_tokens") or 1024

        try:
            temperature = float(raw_temp)
        except (ValueError, TypeError):
            temperature = 0.7

        try:
            top_p = float(raw_top_p)
        except (ValueError, TypeError):
            top_p = 0.9

        try:
            min_p = float(raw_min_p) if raw_min_p is not None else None
        except (ValueError, TypeError):
            min_p = None

        try:
            repetition_penalty = float(raw_rep_pen) if raw_rep_pen is not None else 1.05
        except (ValueError, TypeError):
            repetition_penalty = 1.05

        try:
            max_tokens = int(raw_max_tokens) if raw_max_tokens is not None else 1024
        except (ValueError, TypeError):
            max_tokens = 1024

        assistant_text = await llm_service.generate_chat_completion(
            messages=formatted_messages,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            min_p=min_p,
            repetition_penalty=repetition_penalty
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
