/**
 * Validates and parses character card JSON from various formats:
 * - Tavern Spec v2 (spec: 'chara_card_v2' with data object)
 * - Tavern Spec v1 / SillyTavern standard format
 * - CAI Orchestrator / Pygmalion formats
 *
 * Adheres to spec_v2.md and keyword_definitions.md requirements.
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

  // Name extraction and validation (MUST be present and non-empty)
  const rawName = data.name || data.char_name || parsed.name || parsed.char_name;
  if (rawName === undefined || rawName === null) {
    throw new Error('Validation failed: Missing required field "name" (or "char_name").');
  }

  const name = String(rawName).trim();
  if (name.length === 0) {
    throw new Error('Validation failed: Character "name" cannot be empty or whitespace.');
  }

  // Description / Summary validation & extraction
  const description = String(
    data.description ??
    data.summary ??
    parsed.description ??
    parsed.summary ??
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

  // Dialogue Examples
  const mes_example = String(
    data.mes_example ??
    parsed.mes_example ??
    ''
  ).trim();

  // Creator Notes (MUST NOT be in prompt, SHOULD be displayed to user)
  const creator_notes = String(
    data.creator_notes ??
    parsed.creator_notes ??
    ''
  ).trim();

  // System Prompt validation & extraction
  const system_prompt = String(
    data.system_prompt ??
    data.system_instructions ??
    parsed.system_prompt ??
    ''
  ).trim();

  // Post-History Instructions (UJB / Jailbreak)
  const post_history_instructions = String(
    data.post_history_instructions ??
    parsed.post_history_instructions ??
    ''
  ).trim();

  // Alternate Greetings (Array of strings)
  let alternate_greetings = [];
  const rawAltGreetings = data.alternate_greetings || parsed.alternate_greetings;
  if (Array.isArray(rawAltGreetings)) {
    alternate_greetings = rawAltGreetings.map((g) => String(g).trim()).filter(Boolean);
  }

  // Character Book (Optional Lorebook - MUST NOT be destroyed)
  const character_book = (typeof data.character_book === 'object' && data.character_book !== null && !Array.isArray(data.character_book))
    ? data.character_book
    : ((typeof parsed.character_book === 'object' && parsed.character_book !== null && !Array.isArray(parsed.character_book)) ? parsed.character_book : null);

  // Tags validation (Array of strings)
  let tags = [];
  const rawTags = data.tags || parsed.tags;
  if (Array.isArray(rawTags)) {
    tags = rawTags.map((t) => String(t).trim()).filter(Boolean);
  }

  // Creator & Version
  const creator = String(data.creator || parsed.creator || 'User').trim();
  const character_version = String(data.character_version || parsed.character_version || '1.0').trim();

  // Extensions (MUST default to {}, MUST NOT destroy unknown key-value pairs)
  let extensions = {};
  if (data.extensions && typeof data.extensions === 'object' && !Array.isArray(data.extensions)) {
    extensions = { ...data.extensions };
  } else if (parsed.extensions && typeof parsed.extensions === 'object' && !Array.isArray(parsed.extensions)) {
    extensions = { ...parsed.extensions };
  }

  // Voice preset validation
  // Sampling parameters (temperature, top_p, min_p, repetition_penalty, max_tokens)
  const rawTemp = data.temperature ?? parsed.temperature ?? extensions.temperature;
  const temperature = rawTemp !== undefined && rawTemp !== null && !isNaN(Number(rawTemp)) ? Number(rawTemp) : 0.7;

  const rawTopP = data.top_p ?? parsed.top_p ?? extensions.top_p;
  const top_p = rawTopP !== undefined && rawTopP !== null && !isNaN(Number(rawTopP)) ? Number(rawTopP) : 0.9;

  const rawMinP = data.min_p ?? parsed.min_p ?? extensions.min_p;
  const min_p = rawMinP !== undefined && rawMinP !== null && !isNaN(Number(rawMinP)) ? Number(rawMinP) : 0.0;

  const rawRepPen = data.repetition_penalty ?? parsed.repetition_penalty ?? extensions.repetition_penalty;
  const repetition_penalty = rawRepPen !== undefined && rawRepPen !== null && !isNaN(Number(rawRepPen)) ? Number(rawRepPen) : 1.05;

  const rawMaxTokens = data.max_tokens ?? data.max_response_tokens ?? parsed.max_tokens ?? parsed.max_response_tokens ?? extensions.max_tokens ?? extensions.max_response_tokens;
  const max_tokens = rawMaxTokens !== undefined && rawMaxTokens !== null && !isNaN(Number(rawMaxTokens)) ? parseInt(rawMaxTokens, 10) : 1024;

  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    name,
    description,
    summary: description,
    personality,
    scenario,
    first_mes,
    mes_example,
    creator_notes,
    system_prompt,
    post_history_instructions,
    alternate_greetings,
    character_book,
    tags,
    creator,
    character_version,
    temperature,
    top_p,
    min_p,
    repetition_penalty,
    max_tokens,
    extensions,
    voice_preset,
    specDetected
  };
}
