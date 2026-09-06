import re
from typing import List, Dict, Any, Optional

class SpeakerSelector:
    """
    Intelligent Speaker Selection for Multi-Character Group Chats:
    1. Direct @mention parsing from the latest message.
    2. Context & Keyword affinity scoring against character expertise_keywords, personality, and description.
    3. Recency / monopolization penalty to ensure dynamic turn alternation across characters.
    """

    def extract_mention(self, text: str, room_characters: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Extracts explicit @CharacterName or @Name from message text and matches against room characters.
        """
        if not text or not room_characters:
            return None

        # Find all @mentions in text (e.g., @Alice, @"Dr. Smith", @Bob)
        mention_matches = re.findall(r'@(?:\"([^\"]+)\"|([a-zA-Z0-9_\-\.]+))', text)
        extracted_names = [m[0] or m[1] for m in mention_matches if (m[0] or m[1])]

        for raw_name in extracted_names:
            normalized_query = raw_name.lower().strip()
            for char in room_characters:
                char_name = (char.get("name") or "").lower().strip()
                # Exact name match, first-name match, or partial containment
                if (
                    normalized_query == char_name
                    or normalized_query == char_name.split()[0]
                    or normalized_query in char_name
                ):
                    return char

        return None

    def calculate_topic_score(self, context_text: str, character: Dict[str, Any]) -> float:
        """
        Calculates topic affinity score for a character based on matching keywords from context_text.
        """
        if not context_text:
            return 0.0

        normalized_context = context_text.lower()
        # Tokenize context into words for boundary matching
        words = set(re.findall(r'\b[a-zA-Z0-9_\-]{3,}\b', normalized_context))
        
        score = 0.0

        # 1. Primary match: expertise_keywords (Weight: 3.0 per keyword hit)
        expertise = character.get("expertise_keywords") or []
        for kw in expertise:
            if not kw:
                continue
            kw_clean = str(kw).lower().strip()
            if " " in kw_clean:
                # Multi-word phrase check
                if kw_clean in normalized_context:
                    score += 4.0
            else:
                if kw_clean in words or kw_clean in normalized_context:
                    score += 3.0

        # 2. Secondary match: tags (Weight: 1.5 per tag hit)
        tags = character.get("tags") or []
        for tag in tags:
            tag_clean = str(tag).lower().strip()
            if tag_clean and (tag_clean in words or tag_clean in normalized_context):
                score += 1.5

        # 3. Tertiary match: personality & description (Weight: 0.5 per hit)
        desc_and_persona = f"{character.get('description', '')} {character.get('personality', '')}".lower()
        if desc_and_persona:
            for word in words:
                if len(word) > 3 and word in desc_and_persona:
                    score += 0.25

        return score

    def select_next_speaker(
        self,
        messages: List[Dict[str, Any]],
        room_characters: List[Dict[str, Any]],
        last_speaker_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Selects the best next character to respond given conversation context and active room participants.
        """
        if not room_characters:
            raise ValueError("Cannot select speaker from an empty room_characters list.")

        if len(room_characters) == 1:
            return room_characters[0]

        latest_msg = messages[-1] if messages else {}
        latest_text = str(latest_msg.get("content") or "")

        # 1. Check for explicit @mention in the most recent message
        mentioned_char = self.extract_mention(latest_text, room_characters)
        if mentioned_char:
            return mentioned_char

        # 2. Extract recent context (last 2-3 turns) for topic extraction
        recent_contexts = []
        for msg in messages[-3:]:
            content = msg.get("content")
            if isinstance(content, str):
                recent_contexts.append(content)
        joined_context = " ".join(recent_contexts)

        # 3. Score all available candidates
        scores: List[tuple[Dict[str, Any], float]] = []
        for char in room_characters:
            char_id = str(char.get("id") or "")
            score = self.calculate_topic_score(joined_context, char)

            # Apply recency penalty to prevent consecutive self-replies when other candidates exist
            if last_speaker_id and char_id == str(last_speaker_id):
                score -= 2.0

            scores.append((char, score))

        # Sort descending by score
        scores.sort(key=lambda x: x[1], reverse=True)

        # If top score has a distinct winner (or above negative penalty), return top character
        top_char, top_score = scores[0]

        # If all scores are tied or 0, prioritize a character who didn't just speak
        if top_score <= 0 and last_speaker_id and len(room_characters) > 1:
            alternatives = [c for c in room_characters if str(c.get("id")) != str(last_speaker_id)]
            if alternatives:
                return alternatives[0]

        return top_char

speaker_selector = SpeakerSelector()
