import os
import json
import shutil
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List
from app.models.character import CharacterCard, CharacterCreateRequest, CharacterUpdateRequest

router = APIRouter(prefix="/api/characters", tags=["characters"])

CHARACTERS_DIR = os.path.abspath("backend/characters")
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
def list_characters():
    return load_all_characters()

@router.get("/{card_id}", response_model=CharacterCard)
def get_character(card_id: str):
    cards = load_all_characters()
    for card in cards:
        if card.id == card_id:
            return card
    raise HTTPException(status_code=404, detail="Character not found")

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
