from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.config import (
    DEFAULT_TEMPERATURE,
    DEFAULT_TOP_P,
    DEFAULT_MIN_P,
    DEFAULT_REPETITION_PENALTY,
    DEFAULT_MAX_TOKENS,
)
from app.services.context_manager import context_manager
from app.services.llm_service import llm_service, clean_to_pure_dialogue
from app.services.speaker_selector import speaker_selector

router = APIRouter(prefix="/api/chat", tags=["chat"])

class ChatMessage(BaseModel):
    role: str
    content: Any  # Can be str or multimodal list of dicts (text + image_url)
    sender: Optional[str] = None

class SelectSpeakerRequest(BaseModel):
    messages: List[Dict[str, Any]]
    room_characters: List[Dict[str, Any]]
    last_speaker_id: Optional[str] = None

class ChatRequest(BaseModel):
    character_id: str
    messages: List[Dict[str, Any]]
    story_summary: Optional[str] = None
    character_card: Dict[str, Any]
    scenario: Optional[Dict[str, Any]] = None
    room_characters: Optional[List[Dict[str, Any]]] = None

@router.post("/select-speaker")
def select_speaker(req: SelectSpeakerRequest):
    """
    Intelligently select the next speaking character based on @mentions, topic relevance, and recency penalty.
    """
    try:
        if not req.room_characters:
            raise HTTPException(status_code=400, detail="room_characters list cannot be empty.")
        selected = speaker_selector.select_next_speaker(
            messages=req.messages,
            room_characters=req.room_characters,
            last_speaker_id=req.last_speaker_id
        )
        return {"selected_character": selected}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
        
        raw_temp = char_card.get("temperature") if char_card.get("temperature") is not None else extensions.get("temperature", DEFAULT_TEMPERATURE)
        raw_top_p = char_card.get("top_p") if char_card.get("top_p") is not None else extensions.get("top_p", DEFAULT_TOP_P)
        raw_min_p = char_card.get("min_p") if char_card.get("min_p") is not None else extensions.get("min_p", DEFAULT_MIN_P)
        raw_rep_pen = char_card.get("repetition_penalty") if char_card.get("repetition_penalty") is not None else extensions.get("repetition_penalty", DEFAULT_REPETITION_PENALTY)
        raw_max_tokens = char_card.get("max_tokens") or char_card.get("max_response_tokens") or extensions.get("max_tokens") or extensions.get("max_response_tokens") or DEFAULT_MAX_TOKENS

        try:
            temperature = float(raw_temp)
        except (ValueError, TypeError):
            temperature = DEFAULT_TEMPERATURE

        try:
            top_p = float(raw_top_p)
        except (ValueError, TypeError):
            top_p = DEFAULT_TOP_P

        try:
            min_p = float(raw_min_p) if raw_min_p is not None else DEFAULT_MIN_P
        except (ValueError, TypeError):
            min_p = DEFAULT_MIN_P

        try:
            repetition_penalty = float(raw_rep_pen) if raw_rep_pen is not None else DEFAULT_REPETITION_PENALTY
        except (ValueError, TypeError):
            repetition_penalty = DEFAULT_REPETITION_PENALTY

        try:
            max_tokens = int(raw_max_tokens) if raw_max_tokens is not None else DEFAULT_MAX_TOKENS
        except (ValueError, TypeError):
            max_tokens = DEFAULT_MAX_TOKENS

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
            # Strip stage directions, asterisks, brackets, and 3rd person narrative prefixes
            cleaned_text = clean_to_pure_dialogue(assistant_text, char_name)

            return {
                "character_id": req.character_id,
                "message": {
                    "role": "assistant",
                    "content": cleaned_text,
                    "sender": char_name
                }
            }

        # Fallback response for offline / dev testing mode
        fallback_text = f"Indeed. Let us explore this conversation further."
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
