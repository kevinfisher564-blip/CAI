import os
import json
import shutil
import time
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Optional, Dict, Any
from app.models.character import CharacterCard, CharacterCreateRequest, CharacterUpdateRequest
from app.config import (
    DEFAULT_TEMPERATURE,
    DEFAULT_TOP_P,
    DEFAULT_MIN_P,
    DEFAULT_REPETITION_PENALTY,
    DEFAULT_MAX_TOKENS,
)

router = APIRouter(prefix="/api/characters", tags=["characters"])

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CHARACTERS_DIR = os.path.abspath(os.path.join(BACKEND_DIR, "characters"))
os.makedirs(CHARACTERS_DIR, exist_ok=True)

def parse_character_data(payload: dict, file_id: Optional[str] = None) -> CharacterCard:
    if not isinstance(payload, dict):
        raise ValueError("Character JSON root must be an object.")

    # Handle Tavern v2 Spec and flat formats
    data = payload
    if payload.get("spec") == "chara_card_v2" or isinstance(payload.get("data"), dict):
        data = payload.get("data", {})
        if not isinstance(data, dict):
            data = {}

    name = str(data.get("name") or data.get("char_name") or payload.get("name") or payload.get("char_name") or "").strip()
    if not name:
        raise ValueError("Validation failed: Character 'name' is required.")

    valid_voice_presets = ["female_narrator", "male_deep", "soft_storyteller", "energetic_companion"]
    voice_preset = data.get("voice_preset") or payload.get("voice_preset")
    if voice_preset not in valid_voice_presets:
        voice_preset = "female_narrator"

    extensions = data.get("extensions") if isinstance(data.get("extensions"), dict) else (payload.get("extensions") if isinstance(payload.get("extensions"), dict) else {})
    character_book = data.get("character_book") if isinstance(data.get("character_book"), dict) else (payload.get("character_book") if isinstance(payload.get("character_book"), dict) else None)

    raw_tags = data.get("tags") or payload.get("tags") or []
    tags = [str(t).strip() for t in raw_tags if str(t).strip()] if isinstance(raw_tags, list) else []

    raw_keywords = data.get("expertise_keywords") or payload.get("expertise_keywords") or extensions.get("expertise_keywords") or []
    expertise_keywords = [str(k).strip() for k in raw_keywords if str(k).strip()] if isinstance(raw_keywords, list) else []

    raw_alt_greetings = data.get("alternate_greetings") or payload.get("alternate_greetings") or []
    alternate_greetings = [str(g).strip() for g in raw_alt_greetings if str(g).strip()] if isinstance(raw_alt_greetings, list) else []

    description = str(data.get("description") or data.get("summary") or payload.get("description") or payload.get("summary") or "").strip()

    # Sampling parameters extraction (support top-level or nested under extensions)
    temperature = data.get("temperature") if data.get("temperature") is not None else (payload.get("temperature") if payload.get("temperature") is not None else extensions.get("temperature", DEFAULT_TEMPERATURE))
    top_p = data.get("top_p") if data.get("top_p") is not None else (payload.get("top_p") if payload.get("top_p") is not None else extensions.get("top_p", DEFAULT_TOP_P))
    min_p = data.get("min_p") if data.get("min_p") is not None else (payload.get("min_p") if payload.get("min_p") is not None else extensions.get("min_p", DEFAULT_MIN_P))
    repetition_penalty = data.get("repetition_penalty") if data.get("repetition_penalty") is not None else (payload.get("repetition_penalty") if payload.get("repetition_penalty") is not None else extensions.get("repetition_penalty", DEFAULT_REPETITION_PENALTY))
    max_tokens = data.get("max_tokens") or data.get("max_response_tokens") or payload.get("max_tokens") or payload.get("max_response_tokens") or extensions.get("max_tokens") or extensions.get("max_response_tokens") or DEFAULT_MAX_TOKENS

    char_id = payload.get("id") or data.get("id") or file_id

    card_kwargs = {
        "spec": "chara_card_v2",
        "spec_version": "2.0",
        "name": name,
        "description": description,
        "summary": description,
        "personality": str(data.get("personality") or data.get("char_persona") or payload.get("personality") or payload.get("char_persona") or "").strip(),
        "scenario": str(data.get("scenario") or data.get("world_scenario") or payload.get("scenario") or payload.get("world_scenario") or "").strip(),
        "first_mes": str(data.get("first_mes") or data.get("char_greeting") or payload.get("first_mes") or payload.get("char_greeting") or "Hello!").strip(),
        "mes_example": str(data.get("mes_example") or payload.get("mes_example") or ""),
        "creator_notes": str(data.get("creator_notes") or payload.get("creator_notes") or "").strip(),
        "system_prompt": str(data.get("system_prompt") or data.get("system_instructions") or payload.get("system_prompt") or payload.get("system_instructions") or "").strip(),
        "post_history_instructions": str(data.get("post_history_instructions") or payload.get("post_history_instructions") or "").strip(),
        "alternate_greetings": alternate_greetings,
        "character_book": character_book,
        "temperature": float(temperature) if temperature is not None else DEFAULT_TEMPERATURE,
        "top_p": float(top_p) if top_p is not None else DEFAULT_TOP_P,
        "min_p": float(min_p) if min_p is not None else DEFAULT_MIN_P,
        "repetition_penalty": float(repetition_penalty) if repetition_penalty is not None else DEFAULT_REPETITION_PENALTY,
        "max_tokens": int(max_tokens) if max_tokens is not None else DEFAULT_MAX_TOKENS,
        "voice_preset": voice_preset,
        "tags": tags,
        "expertise_keywords": expertise_keywords,
        "creator": str(data.get("creator") or payload.get("creator") or "User").strip(),
        "character_version": str(data.get("character_version") or payload.get("character_version") or "1.0").strip(),
        "extensions": extensions,
        "avatar": payload.get("avatar") or data.get("avatar"),
        "voice_sample": payload.get("voice_sample") or data.get("voice_sample"),
        "voice_sample_text": str(data.get("voice_sample_text") or payload.get("voice_sample_text") or "").strip() or None
    }
    if char_id:
        card_kwargs["id"] = str(char_id)

    return CharacterCard(**card_kwargs)

def find_character_filepath(card_id: str) -> Optional[str]:
    direct_path = os.path.join(CHARACTERS_DIR, f"{card_id}.json")
    if os.path.exists(direct_path):
        return direct_path
    
    for file in os.listdir(CHARACTERS_DIR):
        if file.endswith(".json"):
            fp = os.path.join(CHARACTERS_DIR, file)
            stem = os.path.splitext(file)[0]
            if stem == card_id:
                return fp
            try:
                with open(fp, "r", encoding="utf-8") as f:
                    raw = json.load(f)
                cid = raw.get("id") or (raw.get("data", {}).get("id") if isinstance(raw.get("data"), dict) else None)
                if cid == card_id:
                    return fp
            except Exception:
                pass
    return None

def load_all_characters() -> List[CharacterCard]:
    cards = []
    for file in os.listdir(CHARACTERS_DIR):
        if file.endswith(".json"):
            filepath = os.path.join(CHARACTERS_DIR, file)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                file_id = os.path.splitext(file)[0]
                card = parse_character_data(raw_data, file_id=file_id)
                cards.append(card)
            except Exception as e:
                print(f"Error loading {file}: {e}")
    return cards

@router.get("", response_model=List[CharacterCard])
@router.get("/", response_model=List[CharacterCard])
def list_characters():
    return load_all_characters()

@router.get("/{card_id}", response_model=CharacterCard)
def get_character(card_id: str):
    cards = load_all_characters()
    for card in cards:
        if card.id == card_id:
            return card
    raise HTTPException(status_code=404, detail="Character not found")

@router.post("/import", response_model=CharacterCard)
async def import_character(payload: dict):
    try:
        card = parse_character_data(payload)
    except ValueError as ve:
        raise HTTPException(status_code=422, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to import character: {str(e)}")

    filepath = os.path.join(CHARACTERS_DIR, f"{card.id}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(card.model_dump(), f, indent=2)
    return card

@router.post("", response_model=CharacterCard)
def create_character(req: CharacterCreateRequest):
    desc = req.description or req.summary or ""
    card = CharacterCard(
        name=req.name,
        description=desc,
        summary=desc,
        personality=req.personality or "",
        scenario=req.scenario or "",
        first_mes=req.first_mes or "Hello!",
        mes_example=req.mes_example or "",
        creator_notes=req.creator_notes or "",
        system_prompt=req.system_prompt or "",
        post_history_instructions=req.post_history_instructions or "",
        alternate_greetings=req.alternate_greetings or [],
        character_book=req.character_book,
        temperature=req.temperature if req.temperature is not None else DEFAULT_TEMPERATURE,
        top_p=req.top_p if req.top_p is not None else DEFAULT_TOP_P,
        min_p=req.min_p if req.min_p is not None else DEFAULT_MIN_P,
        repetition_penalty=req.repetition_penalty if req.repetition_penalty is not None else DEFAULT_REPETITION_PENALTY,
        max_tokens=req.max_tokens if req.max_tokens is not None else DEFAULT_MAX_TOKENS,
        voice_preset=req.voice_preset or "female_narrator",
        tags=req.tags or [],
        expertise_keywords=req.expertise_keywords or [],
        creator=req.creator or "User",
        character_version=req.character_version or "1.0",
        avatar=req.avatar,
        voice_sample=req.voice_sample,
        voice_sample_text=req.voice_sample_text,
        extensions=req.extensions or {}
    )
    filepath = os.path.join(CHARACTERS_DIR, f"{card.id}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(card.model_dump(), f, indent=2)
    return card

@router.put("/{card_id}", response_model=CharacterCard)
def update_character(card_id: str, req: CharacterUpdateRequest):
    filepath = find_character_filepath(card_id)
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Character file not found")
    
    with open(filepath, "r", encoding="utf-8") as f:
        raw_data = json.load(f)
    
    card = parse_character_data(raw_data, file_id=os.path.splitext(os.path.basename(filepath))[0])
    update_data = req.model_dump(exclude_unset=True)
    if "description" in update_data and "summary" not in update_data:
        update_data["summary"] = update_data["description"]
    elif "summary" in update_data and "description" not in update_data:
        update_data["description"] = update_data["summary"]

    for key, value in update_data.items():
        setattr(card, key, value)
            
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(card.model_dump(), f, indent=2)
        
    return card

@router.post("/{card_id}/voice_sample")
async def upload_voice_sample(
    card_id: str, 
    file: UploadFile = File(...),
    voice_sample_text: Optional[str] = Form(None)
):
    filepath = find_character_filepath(card_id)
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Character not found")
        
    voice_dir = os.path.join(CHARACTERS_DIR, "voice_samples")
    os.makedirs(voice_dir, exist_ok=True)
    
    with open(filepath, "r", encoding="utf-8") as f:
        raw_data = json.load(f)
    card = parse_character_data(raw_data, file_id=os.path.splitext(os.path.basename(filepath))[0])
    
    # Remove previous voice sample file if present
    if card.voice_sample:
        old_sample_path = os.path.join(voice_dir, card.voice_sample)
        if os.path.exists(old_sample_path):
            try:
                os.remove(old_sample_path)
            except Exception:
                pass

    # Clean up any lingering files for this character ID
    for existing_file in os.listdir(voice_dir):
        if existing_file.startswith(f"{card_id}_voice"):
            try:
                os.remove(os.path.join(voice_dir, existing_file))
            except Exception:
                pass
                
    ext = os.path.splitext(file.filename)[1] or ".wav"
    sample_filename = f"{card_id}_voice_{int(time.time())}{ext}"
    sample_path = os.path.join(voice_dir, sample_filename)
    
    with open(sample_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    card.voice_sample = sample_filename
    if voice_sample_text is not None:
        card.voice_sample_text = voice_sample_text.strip() or None
    
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(card.model_dump(), f, indent=2)
        
    return {"status": "success", "voice_sample": sample_filename, "voice_sample_text": card.voice_sample_text}

@router.delete("/{card_id}/voice_sample")
async def delete_voice_sample(card_id: str):
    filepath = find_character_filepath(card_id)
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Character not found")
        
    voice_dir = os.path.join(CHARACTERS_DIR, "voice_samples")
    with open(filepath, "r", encoding="utf-8") as f:
        raw_data = json.load(f)
        
    card = parse_character_data(raw_data, file_id=os.path.splitext(os.path.basename(filepath))[0])
    old_sample = card.voice_sample
    card.voice_sample = None
    card.voice_sample_text = None
    
    if old_sample and os.path.exists(voice_dir):
        old_path = os.path.join(voice_dir, old_sample)
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except Exception:
                pass
                
    if os.path.exists(voice_dir):
        for existing_file in os.listdir(voice_dir):
            if existing_file.startswith(f"{card_id}_voice"):
                try:
                    os.remove(os.path.join(voice_dir, existing_file))
                except Exception:
                    pass
                
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(card.model_dump(), f, indent=2)
        
    return {"status": "success", "voice_sample": None, "voice_sample_text": None}


