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

    STOPWORDS = {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
        "by", "from", "up", "about", "into", "over", "after", "is", "are", "was", "were",
        "be", "been", "being", "have", "has", "had", "do", "does", "did", "can", "could",
        "will", "would", "shall", "should", "may", "might", "must", "what", "which", "who",
        "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most",
        "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
        "very", "just", "tell", "think", "know", "hello", "hi", "hey", "please", "help"
    }

    def calculate_topic_score(self, context_text: str, character: Dict[str, Any], is_latest_turn: bool = False) -> float:
        """
        Calculates topic affinity score for a character based on matching keywords from context_text.
        """
        if not context_text:
            return 0.0

        normalized_context = context_text.lower()
        # Tokenize context into words and filter out stopwords
        raw_words = re.findall(r'\b[a-zA-Z0-9_\-]{3,}\b', normalized_context)
        words = {w for w in raw_words if w not in self.STOPWORDS}
        
        score = 0.0
        turn_multiplier = 2.0 if is_latest_turn else 1.0

        # 1. Primary match: expertise_keywords (Weight: 5.0 per hit)
        expertise = character.get("expertise_keywords") or []
        for kw in expertise:
            if not kw:
                continue
            kw_clean = str(kw).lower().strip()
            if " " in kw_clean:
                # Multi-word phrase check
                if kw_clean in normalized_context:
                    score += 6.0 * turn_multiplier
            else:
                # Exact word or root/stem containment (e.g. 'fence' in 'fencing', 'physics' in 'astrophysics')
                if kw_clean in words or kw_clean in normalized_context:
                    score += 5.0 * turn_multiplier
                elif len(kw_clean) >= 4 and any(kw_clean[:4] in w for w in words):
                    score += 3.5 * turn_multiplier

        # 2. Secondary match: tags (Weight: 2.0 per hit)
        tags = character.get("tags") or []
        for tag in tags:
            tag_clean = str(tag).lower().strip()
            if tag_clean and tag_clean not in self.STOPWORDS:
                if tag_clean in words or tag_clean in normalized_context:
                    score += 2.0 * turn_multiplier

        # 3. Tertiary match: personality & description (Weight: 0.2 per significant content word)
        desc_and_persona = f"{character.get('description', '')} {character.get('personality', '')}".lower()
        if desc_and_persona:
            for word in words:
                if len(word) > 4 and word in desc_and_persona:
                    score += 0.2 * turn_multiplier

        return score

    def select_next_speaker(
        self,
        messages: List[Dict[str, Any]],
        room_characters: List[Dict[str, Any]],
        last_speaker_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Selects the best next character to respond given conversation context and active room participants.
        Strictly prevents the same character from speaking consecutive turns when other room participants exist.
        """
        if not room_characters:
            raise ValueError("Cannot select speaker from an empty room_characters list.")

        if len(room_characters) == 1:
            return room_characters[0]

        latest_msg = messages[-1] if messages else {}
        latest_text = str(latest_msg.get("content") or "")

        # 1. Determine effective last speaker ID (from parameter or by inspecting the latest turn)
        effective_last_speaker_id = str(last_speaker_id) if last_speaker_id else None
        if not effective_last_speaker_id and latest_msg.get("role") == "assistant":
            # Check character_id directly or sender name match
            if latest_msg.get("character_id"):
                effective_last_speaker_id = str(latest_msg["character_id"])
            elif latest_msg.get("sender"):
                sender_name = str(latest_msg["sender"]).lower().strip()
                for c in room_characters:
                    if (c.get("name") or "").lower().strip() == sender_name:
                        effective_last_speaker_id = str(c.get("id") or "")
                        break

        # 2. Filter candidate characters to strictly exclude the last speaker from replying to itself
        if effective_last_speaker_id and len(room_characters) > 1:
            candidate_characters = [c for c in room_characters if str(c.get("id") or "") != effective_last_speaker_id]
            if not candidate_characters:
                candidate_characters = room_characters
        else:
            candidate_characters = room_characters

        # 3. Check for explicit @mention targeting one of the eligible candidate characters
        mentioned_char = self.extract_mention(latest_text, candidate_characters)
        if mentioned_char:
            return mentioned_char

        # 4. Score eligible candidates with high emphasis on latest user message and recent context
        scores: List[tuple[Dict[str, Any], float]] = []
        for char in candidate_characters:
            # Score latest message heavily
            latest_score = self.calculate_topic_score(latest_text, char, is_latest_turn=True)
            
            # Score preceding 2 messages with lower weight
            older_score = 0.0
            if len(messages) > 1:
                older_contexts = [str(m.get("content") or "") for m in messages[-3:-1]]
                older_score = self.calculate_topic_score(" ".join(older_contexts), char, is_latest_turn=False)

            total_score = latest_score + (older_score * 0.5)
            scores.append((char, total_score))

        # Sort descending by score
        scores.sort(key=lambda x: x[1], reverse=True)

        return scores[0][0]

speaker_selector = SpeakerSelector()
