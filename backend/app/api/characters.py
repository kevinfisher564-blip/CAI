import os
import json
import shutil
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List
from app.models.character import CharacterCard, CharacterCreateRequest, CharacterUpdateRequest

router = APIRouter(prefix="/api/characters", tags=["characters"])

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CHARACTERS_DIR = os.path.abspath(os.path.join(BACKEND_DIR, "characters"))
os.makedirs(CHARACTERS_DIR, exist_ok=True)

def load_all_characters() -> List[CharacterCard]:
    cards = []
    for file in os.listdir(CHARACTERS_DIR):
        if file.endswith(".json"):
            filepath = os.path.join(CHARACTERS_DIR, file)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                cards.append(CharacterCard(**data))
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
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Character JSON root must be an object.")

    # Handle Tavern v2 Spec
    data = payload
    if payload.get("spec") == "chara_card_v2" or isinstance(payload.get("data"), dict):
        data = payload.get("data", {})
        if not isinstance(data, dict):
            raise HTTPException(status_code=400, detail="Malformed Tavern v2 Card: 'data' must be an object.")

    name = str(data.get("name") or data.get("char_name") or payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Validation failed: Character 'name' is required.")

    valid_voice_presets = ["female_narrator", "male_deep", "soft_storyteller", "energetic_companion"]
    voice_preset = data.get("voice_preset") or payload.get("voice_preset")
    if voice_preset not in valid_voice_presets:
        voice_preset = "female_narrator"

    raw_tags = data.get("tags") or payload.get("tags") or []
    tags = [str(t).strip() for t in raw_tags if str(t).strip()] if isinstance(raw_tags, list) else []

    raw_alt_greetings = data.get("alternate_greetings") or payload.get("alternate_greetings") or []
    alternate_greetings = [str(g).strip() for g in raw_alt_greetings if str(g).strip()] if isinstance(raw_alt_greetings, list) else []

    description = str(data.get("description") or data.get("summary") or payload.get("description") or payload.get("summary") or "").strip()
    
    extensions = data.get("extensions") if isinstance(data.get("extensions"), dict) else (payload.get("extensions") if isinstance(payload.get("extensions"), dict) else {})
    character_book = data.get("character_book") if isinstance(data.get("character_book"), dict) else (payload.get("character_book") if isinstance(payload.get("character_book"), dict) else None)

    # Sampling parameters extraction (support top-level or nested under extensions)
    temperature = data.get("temperature") if data.get("temperature") is not None else extensions.get("temperature", 0.7)
    top_p = data.get("top_p") if data.get("top_p") is not None else extensions.get("top_p", 0.9)
    min_p = data.get("min_p") if data.get("min_p") is not None else extensions.get("min_p", 0.0)
    repetition_penalty = data.get("repetition_penalty") if data.get("repetition_penalty") is not None else extensions.get("repetition_penalty", 1.05)
    max_tokens = data.get("max_tokens") or data.get("max_response_tokens") or extensions.get("max_tokens") or extensions.get("max_response_tokens") or 1024

    card = CharacterCard(
        spec="chara_card_v2",
        spec_version="2.0",
        name=name,
        description=description,
        summary=description,
        personality=str(data.get("personality") or data.get("char_persona") or payload.get("personality") or "").strip(),
        scenario=str(data.get("scenario") or data.get("world_scenario") or payload.get("scenario") or "").strip(),
        first_mes=str(data.get("first_mes") or data.get("char_greeting") or payload.get("first_mes") or "Hello!").strip(),
        mes_example=str(data.get("mes_example") or payload.get("mes_example") or ""),
        creator_notes=str(data.get("creator_notes") or payload.get("creator_notes") or "").strip(),
        system_prompt=str(data.get("system_prompt") or data.get("system_instructions") or payload.get("system_prompt") or "").strip(),
        post_history_instructions=str(data.get("post_history_instructions") or payload.get("post_history_instructions") or "").strip(),
        alternate_greetings=alternate_greetings,
        character_book=character_book,
        temperature=float(temperature) if temperature is not None else 0.7,
        top_p=float(top_p) if top_p is not None else 0.9,
        min_p=float(min_p) if min_p is not None else 0.0,
        repetition_penalty=float(repetition_penalty) if repetition_penalty is not None else 1.05,
        max_tokens=int(max_tokens) if max_tokens is not None else 1024,
        voice_preset=voice_preset,
        tags=tags,
        creator=str(data.get("creator") or payload.get("creator") or "User").strip(),
        character_version=str(data.get("character_version") or payload.get("character_version") or "1.0").strip(),
        extensions=extensions
    )

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
        temperature=req.temperature if req.temperature is not None else 0.7,
        top_p=req.top_p if req.top_p is not None else 0.9,
        min_p=req.min_p if req.min_p is not None else 0.0,
        repetition_penalty=req.repetition_penalty if req.repetition_penalty is not None else 1.05,
        max_tokens=req.max_tokens if req.max_tokens is not None else 1024,
        voice_preset=req.voice_preset or "female_narrator",
        tags=req.tags or [],
        creator=req.creator or "User",
        character_version=req.character_version or "1.0",
        extensions=req.extensions or {}
    )
    filepath = os.path.join(CHARACTERS_DIR, f"{card.id}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(card.model_dump(), f, indent=2)
    return card

@router.put("/{card_id}", response_model=CharacterCard)
def update_character(card_id: str, req: CharacterUpdateRequest):
    filepath = os.path.join(CHARACTERS_DIR, f"{card_id}.json")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Character file not found")
    
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    card = CharacterCard(**data)
    update_data = req.model_dump(exclude_unset=True)
    if "description" in update_data and "summary" not in update_data:
        update_data["summary"] = update_data["description"]
    elif "summary" in update_data and "description" not in update_data:
        update_data["description"] = update_data["summary"]

    for key, value in update_data.items():
        if value is not None:
            setattr(card, key, value)
            
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(card.model_dump(), f, indent=2)
        
    return card

@router.post("/{card_id}/voice_sample")
async def upload_voice_sample(card_id: str, file: UploadFile = File(...)):
    filepath = os.path.join(CHARACTERS_DIR, f"{card_id}.json")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Character not found")
        
    os.makedirs(os.path.join(CHARACTERS_DIR, "voice_samples"), exist_ok=True)
    sample_filename = f"{card_id}_voice{os.path.splitext(file.filename)[1]}"
    sample_path = os.path.join(CHARACTERS_DIR, "voice_samples", sample_filename)
    
    with open(sample_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    card = CharacterCard(**data)
    card.voice_sample = sample_filename
    
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(card.model_dump(), f, indent=2)
        
    return {"status": "success", "voice_sample": sample_filename}
