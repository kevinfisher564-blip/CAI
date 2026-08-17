/**
 * Validates and parses character card JSON from various formats:
 * - Tavern Spec v2 (spec: 'chara_card_v2' with data object)
 * - Tavern Spec v1 / SillyTavern standard format
 * - CAI Orchestrator / Pygmalion formats
 *
 * @param {string|object} input - Raw JSON string or parsed object
 * @returns {object} Normalized and validated character data
 * @throws {Error} Detailed validation error if JSON is malformed or invalid
 */
export function validateAndParseCharacterJson(input) {
  if (input === null || input === undefined) {
    throw new Error('No character JSON data provided.');
  }

  let parsed;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new Error('Character JSON file is empty.');
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      throw new Error(`JSON syntax error: ${err.message}`);
    }
  } else if (typeof input === 'object') {
    parsed = input;
  } else {
    throw new Error('Invalid JSON format: Input must be a valid JSON string or object.');
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
    throw new Error('Invalid Character Card structure: Root must be a JSON object ({...}).');
  }

  let data = parsed;
  let specDetected = 'Standard / Tavern v1';

  // Check for Tavern Spec v2 format
  if (parsed.spec === 'chara_card_v2' || (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data))) {
    if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
      throw new Error('Malformed Tavern v2 Card: Root specifies chara_card_v2 but "data" field is missing or not an object.');
    }
    data = parsed.data;
    specDetected = 'Tavern Spec v2';
  }

  // Name extraction and validation
  const rawName = data.name || data.char_name || parsed.name || parsed.char_name;
  if (rawName === undefined || rawName === null) {
    throw new Error('Validation failed: Missing required field "name" (or "char_name").');
  }

  const name = String(rawName).trim();
  if (name.length === 0) {
    throw new Error('Validation failed: Character "name" cannot be empty or whitespace.');
  }

  // Summary / Description validation & extraction
  const summary = String(
    data.summary ??
    data.description ??
    parsed.summary ??
    parsed.description ??
    ''
  ).trim();

  // Personality validation & extraction
  const personality = String(
    data.personality ??
    data.char_persona ??
    parsed.personality ??
    parsed.char_persona ??
    ''
  ).trim();

  // Scenario validation & extraction
  const scenario = String(
    data.scenario ??
    data.world_scenario ??
    parsed.scenario ??
    parsed.world_scenario ??
    ''
  ).trim();

  // Greeting Message validation & extraction
  const first_mes = String(
    data.first_mes ??
    data.char_greeting ??
    data.greeting ??
    parsed.first_mes ??
    parsed.greeting ??
    'Hello! How can I help you today?'
  ).trim();

  // System Prompt validation & extraction
  const system_prompt = String(
    data.system_prompt ??
    data.post_history_instructions ??
    data.system_instructions ??
    parsed.system_prompt ??
    ''
  ).trim();

  // Voice preset validation
  const validVoicePresets = ['female_narrator', 'male_deep', 'soft_storyteller', 'energetic_companion'];
  const rawVoicePreset = data.voice_preset || parsed.voice_preset;
  const voice_preset = validVoicePresets.includes(rawVoicePreset) ? rawVoicePreset : 'female_narrator';

  // Tags validation
  let tags = [];
  const rawTags = data.tags || parsed.tags;
  if (Array.isArray(rawTags)) {
    tags = rawTags.map((t) => String(t).trim()).filter(Boolean);
  }

  return {
    name,
    summary,
    personality,
    scenario,
    first_mes,
    system_prompt,
    voice_preset,
    tags,
    mes_example: String(data.mes_example || parsed.mes_example || ''),
    creator: String(data.creator || parsed.creator || 'Imported'),
    character_version: String(data.character_version || parsed.character_version || '2.0'),
    specDetected
  };
}
