from typing import List, Dict, Any, Optional
import re

class ContextManager:
    """
    3-Tier Context Architecture Manager compliant with Tavern Spec V2:
    Tier 1: Global Scenario Setting, Room Participants, Character Identity & Persona
    Tier 2: Story Recap, Lorebook Recaps, & Dialogue Examples (mes_example)
    Tier 3: Recent Conversation Sliding Window & Post-History Instructions (UJB)
    """

    def __init__(self, max_context_tokens: int = 32768, sliding_window_turns: int = 40):
        self.max_context_tokens = max_context_tokens
        self.sliding_window_turns = sliding_window_turns

    def replace_macros(self, text: str, char_name: str, user_name: str = "User", original_fallback: str = "") -> str:
        """
        Replaces standard V2 macros: {{char}}, {{user}}, <USER>, <BOT>, {{original}}
        """
        if not text:
            return ""
        result = text
        result = re.sub(r'\{\{char\}\}', char_name, result, flags=re.IGNORECASE)
        result = re.sub(r'<BOT>', char_name, result, flags=re.IGNORECASE)
        result = re.sub(r'\{\{user\}\}', user_name, result, flags=re.IGNORECASE)
        result = re.sub(r'<USER>', user_name, result, flags=re.IGNORECASE)
        result = re.sub(r'\{\{original\}\}', original_fallback, result, flags=re.IGNORECASE)
        return result

    def build_prompt_payload(
        self,
        character_data: Dict[str, Any],
        conversation_history: List[Dict[str, Any]],
        story_summary: Optional[str] = None,
        scenario_data: Optional[Dict[str, Any]] = None,
        room_characters: Optional[List[Dict[str, Any]]] = None,
        user_name: str = "User"
    ) -> List[Dict[str, Any]]:
        
        char_name = character_data.get('name', 'Character')
        system_blocks = []

        # 1. Global Scenario / World Setting (Shared across all characters in the room)
        if scenario_data:
            scenario_title = scenario_data.get("title", "Active Scenario")
            raw_scenario = scenario_data.get("scenario_prompt") or scenario_data.get("summary") or ""
            if raw_scenario:
                cleaned_scenario = self.replace_macros(raw_scenario, char_name, user_name)
                system_blocks.append(f"=== WORLD SCENARIO: {scenario_title} ===\n{cleaned_scenario}")

        # 2. Room Participants Awareness
        if room_characters and len(room_characters) > 1:
            participant_details = []
            for c in room_characters:
                c_name = c.get("name", "Character")
                kws = c.get("expertise_keywords") or []
                if kws:
                    participant_details.append(f"{c_name} (Expertise/Interests: {', '.join(kws)})")
                else:
                    participant_details.append(c_name)

            system_blocks.append(
                f"=== ROOM PARTICIPANTS ===\n"
                f"The following individuals are present in this scene:\n- " + "\n- ".join(participant_details) + "\n"
                f"Stay fully in character as {char_name}. You can talk to {user_name} or reply directly to any of the other characters in the room."
            )

        # 3. Responding Character Identity & Persona (Tavern Spec V2 Tier 1)
        char_info = []
        char_info.append(f"You are roleplaying as: {char_name}")
        
        description = character_data.get('description') or character_data.get('summary')
        if description:
            char_info.append(f"Description: {self.replace_macros(description, char_name, user_name)}")
            
        if character_data.get('personality'):
            char_info.append(f"Personality: {self.replace_macros(character_data.get('personality'), char_name, user_name)}")
            
        if character_data.get('expertise_keywords'):
            char_info.append(f"Areas of Expertise & Interests: {', '.join(character_data.get('expertise_keywords'))}")

        if character_data.get('scenario'):
            char_info.append(f"Character Background Context: {self.replace_macros(character_data.get('scenario'), char_name, user_name)}")

        # System prompt handling (with {{original}} replacement support)
        if character_data.get('system_prompt'):
            system_prompt_text = self.replace_macros(
                character_data.get('system_prompt'), 
                char_name, 
                user_name, 
                original_fallback="Stay fully in character and respond naturally."
            )
            char_info.append(f"Instructions: {system_prompt_text}")

        system_blocks.append(f"=== CHARACTER IDENTITY ===\n" + "\n".join(char_info))
            
        # 4. Example Dialogue (mes_example) - Tier 2
        if character_data.get('mes_example'):
            cleaned_example = self.replace_macros(character_data.get('mes_example'), char_name, user_name)
            system_blocks.append(f"=== DIALOGUE EXAMPLES ===\n{cleaned_example}")

        # 5. Story Recap & Milestones (Tier 2)
        if story_summary:
            system_blocks.append(f"=== STORY RECAP & MILESTONES ===\n{story_summary}")

        # 6. Spoken Dialogue Rules (Pure Dialogue Directives)
        system_blocks.append(
            f"=== OUTPUT FORMAT RULES (PURE DIALOGUE ONLY) ===\n"
            f"- Roleplay medium: Direct live spoken conversation.\n"
            f"- Generate ONLY spoken dialogue in first-person as {char_name}.\n"
            f"- STRICTLY PROHIBITED: Do not write narrative prose, scene descriptions, body language, facial expressions, inner thoughts, or stage directions.\n"
            f"- Do NOT use asterisks (*...*), brackets ([...]), or parentheses ((...)) for actions or expressions.\n"
            f"- Do NOT refer to yourself in the third person or prefix your lines with '{char_name}:' or '{{char}}:'.\n"
            f"- Output the exact spoken words directly, as if speaking aloud into a microphone."
        )

        full_system_prompt = "\n\n".join(system_blocks)
        
        messages = [
            {"role": "system", "content": full_system_prompt}
        ]

        # 7. Tier 3: Add recent sliding window messages
        recent_turns = conversation_history[-self.sliding_window_turns:] if len(conversation_history) > self.sliding_window_turns else conversation_history
        for turn in recent_turns:
            turn_role = turn.get("role", "user")
            sender = turn.get("sender")
            raw_content = turn.get("content", "")
            content_str = raw_content if isinstance(raw_content, str) else str(raw_content)

            if turn_role == "assistant":
                # If this message was generated by the CURRENT responding character, assign role: 'assistant'
                if sender and sender.lower().strip() == char_name.lower().strip():
                    # Strip self-prefix if model had prepended it
                    if content_str.startswith(f"{char_name}:"):
                        content_str = content_str[len(f"{char_name}:"):].strip()
                    messages.append({"role": "assistant", "content": content_str})
                else:
                    # Message from ANOTHER character in the room -> present as role: 'user' with name prefix
                    speaker_label = sender or "Participant"
                    if not content_str.startswith(f"{speaker_label}:"):
                        content_str = f"{speaker_label}: {content_str}"
                    messages.append({"role": "user", "content": content_str})
            else:
                # Direct user turn
                messages.append({
                    "role": "user",
                    "content": raw_content
                })

        # 8. Post-History Instructions (UJB / Jailbreak) - Appended after history
        dialogue_reminder = f"Generate ONLY direct spoken dialogue as {char_name}. No actions, no asterisks, no narrative prose."
        if character_data.get('post_history_instructions'):
            ujb_text = self.replace_macros(
                character_data.get('post_history_instructions'),
                char_name,
                user_name,
                original_fallback="Ensure the response remains concise and formatted properly in-character."
            )
            messages.append({"role": "system", "content": f"[POST-HISTORY DIRECTIVE]:\n{ujb_text}\n{dialogue_reminder}"})
        else:
            messages.append({"role": "system", "content": f"[DIRECTIVE]:\n{dialogue_reminder}"})

        return messages

context_manager = ContextManager()
