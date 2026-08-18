from pydantic import BaseModel, Field
from typing import List, Optional
import uuid

class ScenarioCard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    summary: str = ""
    scenario_prompt: str = ""
    initial_message: Optional[str] = ""
    tags: List[str] = Field(default_factory=list)
    creator: str = "User"
    version: str = "1.0"

class ScenarioCreateRequest(BaseModel):
    title: str
    summary: Optional[str] = ""
    scenario_prompt: Optional[str] = ""
    initial_message: Optional[str] = ""
    tags: Optional[List[str]] = Field(default_factory=list)

class ScenarioUpdateRequest(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    scenario_prompt: Optional[str] = None
    initial_message: Optional[str] = None
    tags: Optional[List[str]] = None
