import os
import json
from fastapi import APIRouter, HTTPException
from typing import List
from app.models.scenario import ScenarioCard, ScenarioCreateRequest, ScenarioUpdateRequest

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCENARIOS_DIR = os.path.abspath(os.path.join(BACKEND_DIR, "scenarios"))
os.makedirs(SCENARIOS_DIR, exist_ok=True)

DEFAULT_SCENARIOS = [
    {
        "id": "neon-cyberpunk-investigation",
        "title": "Neon District Investigation",
        "summary": "A high-stakes inquiry in the rain-slicked underbelly of Neo-Cascadia.",
        "scenario_prompt": "Setting: Year 2098, Sector 4 of Neo-Cascadia. The rain is acidic and flickering holographic neon advertisements bathe the alleyways in amber and cyan. A mysterious encrypted data core was found at the scene of an abandoned underground lab. Tension is high, corporate enforcers are searching the perimeter, and all participants must navigate danger, secrets, and shifting loyalties.",
        "initial_message": "*Acid rain patters against the metal awning above. The distant hum of hover-traffic vibrates through the pavement as the investigation begins.*",
        "tags": ["Cyberpunk", "Investigation", "Sci-Fi"]
    },
    {
        "id": "forgotten-tavern-crossroads",
        "title": "The Crossroads Tavern",
        "summary": "A warm hearth where adventurers, wanderers, and mystics cross paths.",
        "scenario_prompt": "Setting: The Wayfarer's Rest, a stone-and-timber tavern nestled at the edge of the Whispering Woods. A crackling hearth keeps the autumn chill at bay. Tankards of spiced ale clink amidst murmurs of ancient ruins recently uncovered in the northern mountains. All characters present have gathered here with their own ambitions, quests, and mysteries.",
        "initial_message": "*The hearth logs pop, sending sparks swirling into the chimney. The aroma of roasted stew and old parchment fills the air as glances are exchanged across the room.*",
        "tags": ["Fantasy", "Tavern", "Roleplay"]
    },
    {
        "id": "victorian-manor-mystery",
        "title": "Blackwood Manor Mystery",
        "summary": "A locked-room intrigue during a stormy evening in 1892.",
        "scenario_prompt": "Setting: Blackwood Manor, Autumn 1892. A violent thunderstorm has washed out the bridge, leaving all guests trapped inside the grand estate. The eccentric Lord Blackwood has vanished from his locked study, leaving behind an open safe, a strange cipher on the mahogany desk, and suspicion among everyone present.",
        "initial_message": "*Thunder rumbles overhead, rattling the stained-glass windows of the grand parlor. The grandfather clock chimes midnight as the tension becomes palpable.*",
        "tags": ["Mystery", "Victorian", "Suspense"]
    }
]

def init_default_scenarios():
    for sc in DEFAULT_SCENARIOS:
        filepath = os.path.join(SCENARIOS_DIR, f"{sc['id']}.json")
        if not os.path.exists(filepath):
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(sc, f, indent=2)

init_default_scenarios()

def load_all_scenarios() -> List[ScenarioCard]:
    scenarios = []
    for file in os.listdir(SCENARIOS_DIR):
        if file.endswith(".json"):
            filepath = os.path.join(SCENARIOS_DIR, file)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                scenarios.append(ScenarioCard(**data))
            except Exception as e:
                print(f"Error loading scenario {file}: {e}")
    return scenarios

@router.get("", response_model=List[ScenarioCard])
@router.get("/", response_model=List[ScenarioCard])
def list_scenarios():
    return load_all_scenarios()

@router.get("/{scenario_id}", response_model=ScenarioCard)
def get_scenario(scenario_id: str):
    scenarios = load_all_scenarios()
    for s in scenarios:
        if s.id == scenario_id:
            return s
    raise HTTPException(status_code=404, detail="Scenario not found")

@router.post("", response_model=ScenarioCard)
def create_scenario(req: ScenarioCreateRequest):
    scenario = ScenarioCard(
        title=req.title,
        summary=req.summary or "",
        scenario_prompt=req.scenario_prompt or "",
        initial_message=req.initial_message or "",
        tags=req.tags or []
    )
    filepath = os.path.join(SCENARIOS_DIR, f"{scenario.id}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(scenario.model_dump(), f, indent=2)
    return scenario

@router.put("/{scenario_id}", response_model=ScenarioCard)
def update_scenario(scenario_id: str, req: ScenarioUpdateRequest):
    filepath = os.path.join(SCENARIOS_DIR, f"{scenario_id}.json")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Scenario not found")

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    scenario = ScenarioCard(**data)
    update_data = req.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            setattr(scenario, key, value)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(scenario.model_dump(), f, indent=2)

    return scenario

@router.delete("/{scenario_id}")
def delete_scenario(scenario_id: str):
    filepath = os.path.join(SCENARIOS_DIR, f"{scenario_id}.json")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Scenario not found")
    os.remove(filepath)
    return {"status": "deleted", "id": scenario_id}

@router.post("/import", response_model=ScenarioCard)
def import_scenario(payload: dict):
    title = str(payload.get("title") or payload.get("name") or "New Scenario").strip()
    summary = str(payload.get("summary") or payload.get("description") or "").strip()
    scenario_prompt = str(payload.get("scenario_prompt") or payload.get("scenario") or payload.get("world_setting") or "").strip()
    initial_message = str(payload.get("initial_message") or payload.get("first_mes") or "").strip()
    tags = payload.get("tags") if isinstance(payload.get("tags"), list) else []

    scenario = ScenarioCard(
        title=title,
        summary=summary,
        scenario_prompt=scenario_prompt,
        initial_message=initial_message,
        tags=[str(t).strip() for t in tags if str(t).strip()]
    )
    filepath = os.path.join(SCENARIOS_DIR, f"{scenario.id}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(scenario.model_dump(), f, indent=2)
    return scenario
