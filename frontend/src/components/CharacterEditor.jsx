import React, { useState, useEffect, useRef } from 'react';
import { Save, Upload, Volume2, Download, FileUp, AlertCircle, CheckCircle2, Plus, Trash2, Tag, BookOpen, User, Info, Sliders } from 'lucide-react';
import { validateAndParseCharacterJson } from '../utils/characterValidator';

export default function CharacterEditor({ character, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    summary: '',
    personality: '',
    scenario: '',
    first_mes: 'Hello! How can I help you today?',
    mes_example: '',
    creator_notes: '',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: [],
    tags: [],
    creator: 'User',
    character_version: '1.0',
    temperature: 0.7,
    top_p: 0.9,
    min_p: 0.0,
    repetition_penalty: 1.05,
    max_tokens: 1024,
    voice_preset: 'female_narrator',
    voice_sample: null,
    voice_sample_text: '',
    character_book: null,
    extensions: {}
  });

  const [tagInput, setTagInput] = useState('');
  const [newAltGreeting, setNewAltGreeting] = useState('');
  const [voiceFile, setVoiceFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [validationSuccess, setValidationSuccess] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setValidationError(null);
    setValidationSuccess(null);
    setVoiceFile(null);
    if (character) {
      const desc = character.description || character.summary || '';
      const extensions = character.extensions || {};
      
      const temp = character.temperature ?? extensions.temperature ?? 0.7;
      const topP = character.top_p ?? extensions.top_p ?? 0.9;
      const minP = character.min_p ?? extensions.min_p ?? 0.0;
      const repPen = character.repetition_penalty ?? extensions.repetition_penalty ?? 1.05;
      const maxTok = character.max_tokens ?? character.max_response_tokens ?? extensions.max_tokens ?? extensions.max_response_tokens ?? 1024;

      setFormData({
        name: character.name || '',
        description: desc,
        summary: desc,
        personality: character.personality || '',
        scenario: character.scenario || '',
        first_mes: character.first_mes || '',
        mes_example: character.mes_example || '',
        creator_notes: character.creator_notes || '',
        system_prompt: character.system_prompt || '',
        post_history_instructions: character.post_history_instructions || '',
        alternate_greetings: Array.isArray(character.alternate_greetings) ? character.alternate_greetings : [],
        tags: Array.isArray(character.tags) ? character.tags : [],
        creator: character.creator || 'User',
        character_version: character.character_version || '1.0',
        temperature: Number(temp),
        top_p: Number(topP),
        min_p: Number(minP),
        repetition_penalty: Number(repPen),
        max_tokens: Number(maxTok),
        voice_preset: character.voice_preset || 'female_narrator',
        voice_sample: character.voice_sample || null,
        voice_sample_text: character.voice_sample_text || '',
        character_book: character.character_book || null,
        extensions: extensions
      });
    } else {
      setFormData({
        name: '',
        description: '',
        summary: '',
        personality: '',
        scenario: '',
        first_mes: 'Hello! How can I help you today?',
        mes_example: '',
        creator_notes: '',
        system_prompt: '',
        post_history_instructions: '',
        alternate_greetings: [],
        tags: [],
        creator: 'User',
        character_version: '1.0',
        temperature: 0.7,
        top_p: 0.9,
        min_p: 0.0,
        repetition_penalty: 1.05,
        max_tokens: 1024,
        voice_preset: 'female_narrator',
        voice_sample: null,
        voice_sample_text: '',
        character_book: null,
        extensions: {}
      });
    }
  }, [character]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    if (name === 'summary' || name === 'description') {
      setFormData({ ...formData, summary: value, description: value });
    } else if (type === 'number' || type === 'range') {
      setFormData({ ...formData, [name]: parseFloat(value) });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleAddTag = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/^,+|,+$/g, '');
      if (newTag && !formData.tags.includes(newTag)) {
        setFormData({ ...formData, tags: [...formData.tags, newTag] });
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tagToRemove) });
  };

  const handleAddAltGreeting = () => {
    if (newAltGreeting.trim()) {
      setFormData({
        ...formData,
        alternate_greetings: [...formData.alternate_greetings, newAltGreeting.trim()]
      });
      setNewAltGreeting('');
    }
  };

  const handleRemoveAltGreeting = (idx) => {
    setFormData({
      ...formData,
      alternate_greetings: formData.alternate_greetings.filter((_, i) => i !== idx)
    });
  };

  const getSanitizedFilename = () => {
    const rawName = (formData.name || character?.name || 'character').trim();
    const sanitized = rawName
      .toLowerCase()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `${sanitized || 'character'}.json`;
  };

  const handleDownloadJson = () => {
    // Structure 100% compliant Tavern Card V2 JSON
    const desc = formData.description || formData.summary || '';
    const cardData = {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: {
        name: formData.name || character?.name || 'Unnamed Character',
        description: desc,
        personality: formData.personality || '',
        scenario: formData.scenario || '',
        first_mes: formData.first_mes || '',
        mes_example: formData.mes_example || '',
        creator_notes: formData.creator_notes || '',
        system_prompt: formData.system_prompt || '',
        post_history_instructions: formData.post_history_instructions || '',
        alternate_greetings: formData.alternate_greetings || [],
        ...(formData.character_book ? { character_book: formData.character_book } : {}),
        tags: formData.tags || [],
        creator: formData.creator || 'User',
        character_version: formData.character_version || '1.0',
        temperature: formData.temperature,
        top_p: formData.top_p,
        min_p: formData.min_p,
        repetition_penalty: formData.repetition_penalty,
        max_tokens: formData.max_tokens,
        extensions: {
          ...formData.extensions,
          voice_preset: formData.voice_preset || 'female_narrator',
          temperature: formData.temperature,
          top_p: formData.top_p,
          min_p: formData.min_p,
          repetition_penalty: formData.repetition_penalty,
          max_tokens: formData.max_tokens
        }
      }
    };

    const blob = new Blob([JSON.stringify(cardData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = getSanitizedFilename();
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);
  };

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidationError(null);
    setValidationSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result;
        const validated = validateAndParseCharacterJson(content);
        
        setFormData({
          name: validated.name,
          description: validated.description,
          summary: validated.summary,
          personality: validated.personality,
          scenario: validated.scenario,
          first_mes: validated.first_mes,
          mes_example: validated.mes_example,
          creator_notes: validated.creator_notes,
          system_prompt: validated.system_prompt,
          post_history_instructions: validated.post_history_instructions,
          alternate_greetings: validated.alternate_greetings,
          tags: validated.tags,
          creator: validated.creator,
          character_version: validated.character_version,
          temperature: validated.temperature ?? 0.7,
          top_p: validated.top_p ?? 0.9,
          min_p: validated.min_p ?? 0.0,
          repetition_penalty: validated.repetition_penalty ?? 1.05,
          max_tokens: validated.max_tokens ?? 1024,
          voice_preset: validated.voice_preset,
          voice_sample: validated.voice_sample || null,
          voice_sample_text: validated.voice_sample_text || '',
          character_book: validated.character_book,
          extensions: validated.extensions
        });

        setValidationSuccess(
          `Successfully validated & imported "${validated.name}" (${validated.specDetected})`
        );
      } catch (err) {
        setValidationError(err.message || 'Failed to parse and validate character JSON.');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = () => {
      setValidationError('Failed to read the selected file.');
    };

    reader.readAsText(file);
  };

  const handleRemoveVoiceSample = async () => {
    if (character?.id && formData.voice_sample) {
      try {
        await fetch(`/api/characters/${character.id}/voice_sample`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to delete voice sample on server:', err);
      }
    }
    setFormData((prev) => ({ ...prev, voice_sample: null, voice_sample_text: '' }));
    setVoiceFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setValidationError('Character Name is required.');
      return;
    }
    setSaving(true);
    try {
      await onSave(formData, voiceFile, character?.id);
      setValidationSuccess('Character card saved successfully!');
    } catch (err) {
      setValidationError(err.message || 'Failed to save character.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editor-form">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            {character ? `Edit ${character.name}` : 'Create New Character'}
          </h2>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Tavern Spec v2.0 Character Card</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <input 
            type="file" 
            ref={fileInputRef} 
            accept=".json,application/json" 
            style={{ display: 'none' }} 
            onChange={handleFileImport}
          />
          <button 
            type="button" 
            className="secondary-btn" 
            onClick={() => fileInputRef.current?.click()}
            title="Import character from a JSON card file"
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <FileUp size={15} /> Import JSON
          </button>
          <button 
            type="button" 
            className="secondary-btn" 
            onClick={handleDownloadJson}
            title={`Download as ${getSanitizedFilename()}`}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Download size={15} /> Download JSON
          </button>
          <span style={{ fontSize: '0.8rem', color: '#818cf8', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '6px 12px', borderRadius: '12px' }}>
            Spec v2 Compliant
          </span>
        </div>
      </div>

      {validationError && (
        <div className="alert-box error">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div>{validationError}</div>
        </div>
      )}

      {validationSuccess && (
        <div className="alert-box success">
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <div>{validationSuccess}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Core Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label>Character Name * (MUST)</label>
            <input 
              type="text" 
              name="name" 
              className="form-input" 
              value={formData.name} 
              onChange={handleChange} 
              placeholder="e.g. Sherlock Holmes" 
              required 
            />
          </div>

          <div className="form-group">
            <label>Creator</label>
            <input 
              type="text" 
              name="creator" 
              className="form-input" 
              value={formData.creator} 
              onChange={handleChange} 
              placeholder="Creator name" 
            />
          </div>

          <div className="form-group">
            <label>Version</label>
            <input 
              type="text" 
              name="character_version" 
              className="form-input" 
              value={formData.character_version} 
              onChange={handleChange} 
              placeholder="1.0" 
            />
          </div>
        </div>

        {/* Description / Summary */}
        <div className="form-group">
          <label>Description / Tagline</label>
          <input 
            type="text" 
            name="description" 
            className="form-input" 
            value={formData.description} 
            onChange={handleChange} 
            placeholder="e.g. The world's premier consulting detective." 
          />
        </div>

        {/* Creator Notes */}
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Info size={15} color="#818cf8" /> Creator Notes (Displayed to users, MUST NOT be in prompt)
          </label>
          <textarea 
            name="creator_notes" 
            className="form-textarea" 
            value={formData.creator_notes} 
            onChange={handleChange} 
            placeholder="Notes from creator, usage tips, recommended prompt formats, lore links..." 
            style={{ minHeight: '70px' }}
          />
        </div>

        {/* Personality & Behavioral Persona */}
        <div className="form-group">
          <label>Personality & Behavioral Persona</label>
          <textarea 
            name="personality" 
            className="form-textarea" 
            value={formData.personality} 
            onChange={handleChange} 
            placeholder="Describe behavior, tone of voice, quirks, psychological profile, mindset..." 
          />
        </div>

        {/* Scenario / Character Background */}
        <div className="form-group">
          <label>Scenario / Personal Background Context</label>
          <textarea 
            name="scenario" 
            className="form-textarea" 
            value={formData.scenario} 
            onChange={handleChange} 
            placeholder="Personal background, default setting context, or starting scenario..." 
          />
        </div>

        {/* Greeting Message & Alternate Greetings */}
        <div className="form-group">
          <label>Primary Greeting Message (first_mes) *</label>
          <textarea 
            name="first_mes" 
            className="form-textarea" 
            value={formData.first_mes} 
            onChange={handleChange} 
            placeholder="The greeting the character sends when a conversation opens..." 
            required
          />
        </div>

        {/* Alternate Greetings / Swipes */}
        <div className="form-group">
          <label>Alternate Greetings / Swipes ({formData.alternate_greetings.length})</label>
          {formData.alternate_greetings.map((alt, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <div style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.88rem' }}>
                <span style={{ color: '#818cf8', fontWeight: 600, marginRight: '6px' }}>#{idx + 1}:</span>
                {alt}
              </div>
              <button 
                type="button" 
                className="char-action-btn"
                onClick={() => handleRemoveAltGreeting(idx)}
                title="Remove alternate greeting"
              >
                <Trash2 size={14} color="#f87171" />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <textarea 
              className="form-textarea"
              rows={2}
              value={newAltGreeting}
              onChange={(e) => setNewAltGreeting(e.target.value)}
              placeholder="Add another opening greeting option (allows user swiping in chat)..."
              style={{ minHeight: '54px' }}
            />
            <button 
              type="button" 
              className="secondary-btn" 
              onClick={handleAddAltGreeting}
              style={{ alignSelf: 'flex-end', padding: '10px 14px' }}
              title="Add Alternate Greeting"
            >
              <Plus size={16} /> Add
            </button>
          </div>
        </div>

        {/* Dialogue Examples */}
        <div className="form-group">
          <label>Example Dialogue (mes_example)</label>
          <textarea 
            name="mes_example" 
            className="form-textarea" 
            value={formData.mes_example} 
            onChange={handleChange} 
            placeholder="<START>&#10;{{user}}: Good morning.&#10;{{char}}: *Nods curtly* The game is afoot." 
            style={{ minHeight: '90px' }}
          />
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            Supports {"<START>"}, {"{{char}}"}, and {"{{user}}"} dialogue framing format.
          </span>
        </div>

        {/* System Instructions & Post History Instructions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label>System Instructions (system_prompt)</label>
            <textarea 
              name="system_prompt" 
              className="form-textarea" 
              value={formData.system_prompt} 
              onChange={handleChange} 
              placeholder="Main system instructions. Supports {{original}} macro." 
              style={{ minHeight: '90px' }}
            />
          </div>

          <div className="form-group">
            <label>Post-History Instructions (UJB / Jailbreak)</label>
            <textarea 
              name="post_history_instructions" 
              className="form-textarea" 
              value={formData.post_history_instructions} 
              onChange={handleChange} 
              placeholder="Instructions placed after chat history. Supports {{original}} macro." 
              style={{ minHeight: '90px' }}
            />
          </div>
        </div>

        {/* Sampling Hyperparameters (Temperature, Top-P, Min-P, Repetition Penalty, Max Tokens) */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Sliders size={18} color="#818cf8" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Character Model Sampling Parameters</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            {/* Temperature */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem' }}>Temperature</label>
                <span style={{ fontWeight: 700, color: '#818cf8', fontSize: '0.85rem' }}>{Number(formData.temperature).toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                name="temperature"
                min="0.0" 
                max="2.0" 
                step="0.05"
                value={formData.temperature}
                onChange={handleChange}
                style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Creativity vs determinism (0.0 = strict, 0.7 = balanced, 1.2+ = creative)</span>
            </div>

            {/* Top-P */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem' }}>Top-P (Nucleus)</label>
                <span style={{ fontWeight: 700, color: '#06b6d4', fontSize: '0.85rem' }}>{Number(formData.top_p).toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                name="top_p"
                min="0.0" 
                max="1.0" 
                step="0.05"
                value={formData.top_p}
                onChange={handleChange}
                style={{ width: '100%', accentColor: '#06b6d4', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Cumulative probability cutoff (0.9 = top 90% most likely tokens)</span>
            </div>

            {/* Min-P */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem' }}>Min-P</label>
                <span style={{ fontWeight: 700, color: '#a855f7', fontSize: '0.85rem' }}>{Number(formData.min_p).toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                name="min_p"
                min="0.0" 
                max="1.0" 
                step="0.01"
                value={formData.min_p}
                onChange={handleChange}
                style={{ width: '100%', accentColor: '#a855f7', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Discards tokens &lt; X% probability of top token (0.0 = disabled, 0.05 = 5%)</span>
            </div>

            {/* Repetition Penalty */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem' }}>Repetition Penalty</label>
                <span style={{ fontWeight: 700, color: '#ec4899', fontSize: '0.85rem' }}>{Number(formData.repetition_penalty).toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                name="repetition_penalty"
                min="1.0" 
                max="2.0" 
                step="0.01"
                value={formData.repetition_penalty}
                onChange={handleChange}
                style={{ width: '100%', accentColor: '#ec4899', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Penalizes repetitive words and phrasing (1.0 = none, 1.05–1.15 = recommended)</span>
            </div>

            {/* Max Response Tokens */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem' }}>Max Response Tokens</label>
                <span style={{ fontWeight: 700, color: '#10b981', fontSize: '0.85rem' }}>{formData.max_tokens} tokens</span>
              </div>
              <input 
                type="range" 
                name="max_tokens"
                min="64" 
                max="4096" 
                step="64"
                value={formData.max_tokens}
                onChange={handleChange}
                style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Maximum token generation limit per turn (64 = brief, 1024 = detailed, 4096 = long)</span>
            </div>
          </div>
        </div>

        {/* Category Tags */}
        <div className="form-group">
          <label>Category Tags (Press Enter or comma to add)</label>
          <input 
            type="text" 
            className="form-input" 
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            placeholder="e.g. Detective, Victorian, Mystery, Male, Human..." 
          />
          {formData.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {formData.tags.map((tag, idx) => (
                <span 
                  key={idx} 
                  style={{
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#818cf8',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {tag}
                  <button 
                    type="button" 
                    onClick={() => handleRemoveTag(tag)}
                    style={{ background: 'transparent', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '11px' }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Voice Presets & Zero-Shot WAV Reference */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Volume2 size={16} /> Default Voice Preset
            </label>
            <select 
              name="voice_preset" 
              className="form-select" 
              value={formData.voice_preset} 
              onChange={handleChange}
            >
              <option value="female_narrator">Female Narrator (Expressive)</option>
              <option value="male_deep">Male Deep (Resonant)</option>
              <option value="soft_storyteller">Soft Storyteller (Atmospheric)</option>
              <option value="energetic_companion">Energetic Companion (Upbeat)</option>
            </select>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Upload size={16} /> Zero-Shot Voice Reference (Optional WAV)
            </label>

            {/* Currently attached voice sample on server */}
            {formData.voice_sample && !voiceFile && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '6px',
                marginBottom: '8px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 600 }}>Active Voice Sample:</span>
                  <span style={{ fontSize: '0.75rem', color: '#e5e7eb', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {formData.voice_sample}
                  </span>
                  <audio 
                    controls 
                    src={`/static/characters/voice_samples/${formData.voice_sample}`} 
                    style={{ height: '26px', marginTop: '4px', maxWidth: '200px' }} 
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRemoveVoiceSample}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                  title="Remove this voice reference"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Newly selected file waiting for save */}
            {voiceFile && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '6px',
                marginBottom: '8px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 600 }}>Selected for Upload:</span>
                  <span style={{ fontSize: '0.75rem', color: '#e5e7eb', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {voiceFile.name} ({(voiceFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setVoiceFile(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#9ca3af',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                  title="Cancel file selection"
                >
                  ✕
                </button>
              </div>
            )}

            <input 
              type="file" 
              accept="audio/*,.wav,.mp3,.ogg,.m4a" 
              className="form-input"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setVoiceFile(e.target.files[0]);
                }
              }}
            />
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Upload a 3–10 sec clean audio clip (.wav) to clone voice</span>

            {/* Voice Reference Audio Transcript */}
            <div style={{ marginTop: '10px' }}>
              <label style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', display: 'block' }}>
                Voice Reference Transcript (Optional)
              </label>
              <textarea
                name="voice_sample_text"
                className="form-textarea"
                rows={2}
                value={formData.voice_sample_text || ''}
                onChange={handleChange}
                placeholder="Enter the exact spoken words in the audio clip..."
                style={{ fontSize: '0.8rem', resize: 'vertical' }}
              />
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                Providing the exact transcript speeds up F5-TTS generation and prevents Whisper transcription errors.
              </span>
            </div>
          </div>
        </div>

        {/* Lorebook / Extensions Status Info */}
        {(formData.character_book || Object.keys(formData.extensions).length > 0) && (
          <div style={{ padding: '12px 16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.8rem', color: '#9ca3af' }}>
            <div style={{ fontWeight: 600, color: '#f3f4f6', marginBottom: '4px' }}>Embedded Metadata:</div>
            {formData.character_book && (
              <div>• Character Book Lorebook ({formData.character_book.entries?.length || 0} entries preserved)</div>
            )}
            {Object.keys(formData.extensions).length > 0 && (
              <div>• Custom Extensions: {Object.keys(formData.extensions).join(', ')} (preserved)</div>
            )}
          </div>
        )}

        <button type="submit" className="submit-btn" disabled={saving} style={{ marginTop: '10px' }}>
          <Save size={18} /> {saving ? 'Saving Character...' : 'Save Character Card'}
        </button>
      </form>
    </div>
  );
}
