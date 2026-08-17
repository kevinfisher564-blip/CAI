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

    card = CharacterCard(
        name=name,
        summary=str(data.get("summary") or data.get("description") or payload.get("summary") or "").strip(),
        personality=str(data.get("personality") or data.get("char_persona") or payload.get("personality") or "").strip(),
        scenario=str(data.get("scenario") or data.get("world_scenario") or payload.get("scenario") or "").strip(),
        first_mes=str(data.get("first_mes") or data.get("char_greeting") or payload.get("first_mes") or "Hello!").strip(),
        mes_example=str(data.get("mes_example") or payload.get("mes_example") or ""),
        system_prompt=str(data.get("system_prompt") or data.get("system_instructions") or payload.get("system_prompt") or "").strip(),
        voice_preset=voice_preset,
        tags=tags
    )

    filepath = os.path.join(CHARACTERS_DIR, f"{card.id}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(card.model_dump(), f, indent=2)
    return card

@router.post("", response_model=CharacterCard)
def create_character(req: CharacterCreateRequest):
    card = CharacterCard(
        name=req.name,
        summary=req.summary or "",
        personality=req.personality or "",
        scenario=req.scenario or "",
        first_mes=req.first_mes or "Hello!",
        mes_example=req.mes_example or "",
        system_prompt=req.system_prompt or "",
        voice_preset=req.voice_preset or "female_narrator",
        tags=req.tags or []
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
