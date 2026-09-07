/**
 * Utility for echoing conversation and character API calls to the browser console
 * when running in debug mode (e.g. `npm run dev:debug` or `npm run dev -- --mode debug` or `VITE_DEBUG_API=true`).
 */

export const isDebugEnabled = () => {
  if (typeof __API_DEBUG__ !== 'undefined') {
    return Boolean(__API_DEBUG__);
  }
  return import.meta.env?.MODE === 'debug' || import.meta.env?.VITE_DEBUG_API === 'true';
};

export const logApiRequest = (endpoint, characterName, payload) => {
  if (!isDebugEnabled()) return;

  const timestamp = new Date().toLocaleTimeString();
  console.groupCollapsed(
    `%c[${timestamp}] 🚀 API Request: ${endpoint} ${characterName ? `(${characterName})` : ''}`,
    'color: #818cf8; font-weight: bold; font-size: 11px; background: rgba(99, 102, 241, 0.1); padding: 2px 6px; border-radius: 4px;'
  );
  console.log('%cEndpoint:', 'color: #9ca3af; font-weight: bold;', endpoint);
  if (characterName) {
    console.log('%cTarget Character:', 'color: #a78bfa; font-weight: bold;', characterName);
  }
  console.log('%cRaw JSON Payload:', 'color: #94a3b8;', JSON.stringify(payload, null, 2));
  if (payload?.messages) {
    console.table(
      payload.messages.map((m, idx) => ({
        index: idx,
        role: m.role,
        sender: m.sender || (m.role === 'assistant' ? characterName : 'User'),
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      }))
    );
  }
  console.groupEnd();
};

export const logApiResponse = (endpoint, characterName, responseData, durationMs) => {
  if (!isDebugEnabled()) return;

  const timestamp = new Date().toLocaleTimeString();
  const timeLabel = durationMs !== undefined ? ` (${durationMs}ms)` : '';
  console.groupCollapsed(
    `%c[${timestamp}] ✅ API Response: ${endpoint} ${characterName ? `(${characterName})` : ''}${timeLabel}`,
    'color: #34d399; font-weight: bold; font-size: 11px; background: rgba(16, 185, 129, 0.1); padding: 2px 6px; border-radius: 4px;'
  );
  if (responseData?.message?.content) {
    console.log(
      `%cGenerated Dialogue:`,
      'color: #fcd34d; font-weight: bold;',
      responseData.message.content
    );
  }
  console.log('%cFull Response:', 'color: #9ca3af;', responseData);
  console.groupEnd();
};

export const logSpeakerSelection = (selectedChar, candidates, contextHistory) => {
  if (!isDebugEnabled()) return;

  const timestamp = new Date().toLocaleTimeString();
  console.groupCollapsed(
    `%c[${timestamp}] 🎯 Speaker Selected: ${selectedChar?.name || 'None'}`,
    'color: #38bdf8; font-weight: bold; font-size: 11px; background: rgba(56, 189, 248, 0.1); padding: 2px 6px; border-radius: 4px;'
  );
  console.log('%cSelected Character:', 'color: #34d399; font-weight: bold;', selectedChar);
  console.log('%cActive Candidates:', 'color: #9ca3af;', candidates?.map(c => ({ id: c.id, name: c.name, expertise: c.expertise_keywords })));
  console.log('%cContext Analyzed:', 'color: #9ca3af;', contextHistory?.slice(-3));
  console.groupEnd();
};
