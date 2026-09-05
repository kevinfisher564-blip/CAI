from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid

class CharacterCard(BaseModel):
    # Spec V2 Identifiers
    spec: str = "chara_card_v2"
    spec_version: str = "2.0"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    # V1 Core fields
    name: str
    description: str = ""
    summary: str = ""  # Alias/convenience for description
    personality: str = ""
    scenario: str = ""
    first_mes: str = "Hello! How can I help you today?"
    mes_example: str = ""

    # V2 Specification fields
    creator_notes: str = ""
    system_prompt: str = ""
    post_history_instructions: str = ""
    alternate_greetings: List[str] = Field(default_factory=list)
    character_book: Optional[Dict[str, Any]] = None
    tags: List[str] = Field(default_factory=list)
    creator: str = ""
    character_version: str = "1.0"
    extensions: Dict[str, Any] = Field(default_factory=dict)

    # Per-character Model Sampling Hyperparameters
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9
    min_p: Optional[float] = 0.0
    repetition_penalty: Optional[float] = 1.05
    max_tokens: Optional[int] = 1024

    # Local runtime assets & voice settings
    avatar: Optional[str] = None
    voice_sample: Optional[str] = None
    voice_preset: Optional[str] = "female_narrator"

class CharacterCreateRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    summary: Optional[str] = ""
    personality: Optional[str] = ""
    scenario: Optional[str] = ""
    first_mes: Optional[str] = "Hello!"
    mes_example: Optional[str] = ""
    creator_notes: Optional[str] = ""
    system_prompt: Optional[str] = ""
    post_history_instructions: Optional[str] = ""
    alternate_greetings: Optional[List[str]] = Field(default_factory=list)
    character_book: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = Field(default_factory=list)
    creator: Optional[str] = ""
    character_version: Optional[str] = "1.0"
    extensions: Optional[Dict[str, Any]] = Field(default_factory=dict)
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9
    min_p: Optional[float] = 0.0
    repetition_penalty: Optional[float] = 1.05
    max_tokens: Optional[int] = 1024
    voice_preset: Optional[str] = "female_narrator"
    avatar: Optional[str] = None
    voice_sample: Optional[str] = None

class CharacterUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    summary: Optional[str] = None
    personality: Optional[str] = None
    scenario: Optional[str] = None
    first_mes: Optional[str] = None
    mes_example: Optional[str] = None
    creator_notes: Optional[str] = None
    system_prompt: Optional[str] = None
    post_history_instructions: Optional[str] = None
    alternate_greetings: Optional[List[str]] = None
    character_book: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    creator: Optional[str] = None
    character_version: Optional[str] = None
    extensions: Optional[Dict[str, Any]] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    min_p: Optional[float] = None
    repetition_penalty: Optional[float] = None
    max_tokens: Optional[int] = None
    voice_preset: Optional[str] = None
    avatar: Optional[str] = None
    voice_sample: Optional[str] = None
