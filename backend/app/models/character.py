from pydantic import BaseModel, Field
from typing import List, Optional
import uuid

class CharacterCard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    summary: str = ""
    personality: str = ""
    scenario: str = ""
    first_mes: str = "Hello! How can I help you today?"
    mes_example: str = ""
    system_prompt: str = ""
    post_history_instructions: str = ""
    alternate_greetings: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    avatar: Optional[str] = None
    voice_sample: Optional[str] = None
    voice_preset: Optional[str] = "female_narrator"
    creator: str = "User"
    character_version: str = "2.0"

class CharacterCreateRequest(BaseModel):
    name: str
    summary: Optional[str] = ""
    personality: Optional[str] = ""
    scenario: Optional[str] = ""
    first_mes: Optional[str] = "Hello!"
    mes_example: Optional[str] = ""
    system_prompt: Optional[str] = ""
    voice_preset: Optional[str] = "female_narrator"
    tags: Optional[List[str]] = Field(default_factory=list)

class CharacterUpdateRequest(BaseModel):
    name: Optional[str] = None
    summary: Optional[str] = None
    personality: Optional[str] = None
    scenario: Optional[str] = None
    first_mes: Optional[str] = None
    mes_example: Optional[str] = None
    system_prompt: Optional[str] = None
    voice_preset: Optional[str] = None
    tags: Optional[List[str]] = None
