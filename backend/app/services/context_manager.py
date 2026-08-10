from typing import List, Dict, Any, Optional

class ContextManager:
    """
    3-Tier Context Architecture Manager:
    Tier 1: Persona & System Instructions
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
        story_summary: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        
        system_content = []
        system_content.append(f"Name: {character_data.get('name', 'Character')}")
        if character_data.get('summary'):
            system_content.append(f"Summary: {character_data.get('summary')}")
        if character_data.get('personality'):
            system_content.append(f"Personality: {character_data.get('personality')}")
        if character_data.get('scenario'):
            system_content.append(f"Scenario: {character_data.get('scenario')}")
        if character_data.get('system_prompt'):
            system_content.append(f"Instructions: {character_data.get('system_prompt')}")
            
        if story_summary:
            system_content.append(f"\n[STORY RECAP & MILESTONES]:\n{story_summary}")

        full_system_prompt = "\n".join(system_content)
        
        messages = [
            {"role": "system", "content": full_system_prompt}
        ]

        # Tier 3: Add recent sliding window messages
        recent_turns = conversation_history[-self.sliding_window_turns:] if len(conversation_history) > self.sliding_window_turns else conversation_history
        for turn in recent_turns:
            messages.append(turn)

        return messages

context_manager = ContextManager()
