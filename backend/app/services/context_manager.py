from typing import List, Dict, Any, Optional

class ContextManager:
    """
    3-Tier Context Architecture Manager:
    Tier 1: Global Scenario Setting, Room Participants, & Persona Instructions
    Tier 2: Long-Term Story Summary & Vector Lorebook Recaps
    Tier 3: Recent Conversation Sliding Window (up to 32,768 tokens)
    """

    def __init__(self, max_context_tokens: int = 32768, sliding_window_turns: int = 40):
        self.max_context_tokens = max_context_tokens
        self.sliding_window_turns = sliding_window_turns

    def build_prompt_payload(
        self,
        character_data: Dict[str, Any],
        conversation_history: List[Dict[str, Any]],
        story_summary: Optional[str] = None,
        scenario_data: Optional[Dict[str, Any]] = None,
        room_characters: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        
        system_blocks = []

        # 1. Global Scenario / World Setting (Shared across all characters in the room)
        if scenario_data:
            scenario_title = scenario_data.get("title", "Active Scenario")
            scenario_prompt = scenario_data.get("scenario_prompt") or scenario_data.get("summary") or ""
            if scenario_prompt:
                system_blocks.append(f"=== WORLD SCENARIO: {scenario_title} ===\n{scenario_prompt}")

        # 2. Room Participants Awareness
        if room_characters and len(room_characters) > 1:
            participant_names = [c.get("name", "Character") for c in room_characters]
            system_blocks.append(
                f"=== ROOM PARTICIPANTS ===\nThe following individuals are present in this scene: {', '.join(participant_names)}.\n"
                f"Stay fully in character as {character_data.get('name', 'your character')}. You can interact with both the user and other characters in the room."
            )

        # 3. Responding Character Persona & System Instructions
        char_info = []
        char_name = character_data.get('name', 'Character')
        char_info.append(f"You are roleplaying as: {char_name}")
        if character_data.get('summary'):
            char_info.append(f"Summary: {character_data.get('summary')}")
        if character_data.get('personality'):
            char_info.append(f"Personality: {character_data.get('personality')}")
        if character_data.get('scenario'):
            # Optional individual character backstory
            char_info.append(f"Personal Context: {character_data.get('scenario')}")
        if character_data.get('system_prompt'):
            char_info.append(f"Instructions: {character_data.get('system_prompt')}")

        system_blocks.append(f"=== CHARACTER IDENTITY ===\n" + "\n".join(char_info))
            
        # 4. Story Recap & Milestones (Tier 2)
        if story_summary:
            system_blocks.append(f"=== STORY RECAP & MILESTONES ===\n{story_summary}")

        full_system_prompt = "\n\n".join(system_blocks)
        
        messages = [
            {"role": "system", "content": full_system_prompt}
        ]

        # 5. Tier 3: Add recent sliding window messages
        recent_turns = conversation_history[-self.sliding_window_turns:] if len(conversation_history) > self.sliding_window_turns else conversation_history
        for turn in recent_turns:
            # Pass turn directly (keeps role, content, multimodal structure)
            clean_turn = {
                "role": turn.get("role", "user"),
                "content": turn.get("content", "")
            }
            # Prefix character name into content if assistant message has a sender in multi-character chat
            if turn.get("role") == "assistant" and turn.get("sender") and not str(turn.get("content", "")).startswith(f"{turn.get('sender')}:"):
                sender = turn.get("sender")
                raw_content = turn.get("content")
                if isinstance(raw_content, str):
                    clean_turn["content"] = f"{sender}: {raw_content}"
            messages.append(clean_turn)

        return messages

context_manager = ContextManager()
