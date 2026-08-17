import React, { useState, useEffect, useRef } from 'react';
import { Save, Upload, Volume2, Download, FileUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { validateAndParseCharacterJson } from '../utils/characterValidator';

export default function CharacterEditor({ character, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    summary: '',
    personality: '',
    scenario: '',
    first_mes: '',
    system_prompt: '',
    voice_preset: 'female_narrator'
  });

  const [voiceFile, setVoiceFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [validationSuccess, setValidationSuccess] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setValidationError(null);
    setValidationSuccess(null);
    if (character) {
      setFormData({
        name: character.name || '',
        summary: character.summary || '',
        personality: character.personality || '',
        scenario: character.scenario || '',
        first_mes: character.first_mes || '',
        system_prompt: character.system_prompt || '',
        voice_preset: character.voice_preset || 'female_narrator'
      });
    } else {
      setFormData({
        name: '',
        summary: '',
        personality: '',
        scenario: '',
        first_mes: 'Hello! How can I help you today?',
        system_prompt: '',
        voice_preset: 'female_narrator'
      });
    }
  }, [character]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
    const cardData = {
      id: character?.id || undefined,
      name: formData.name || character?.name || 'Unnamed Character',
      summary: formData.summary || '',
      personality: formData.personality || '',
      scenario: formData.scenario || '',
      first_mes: formData.first_mes || '',
      mes_example: character?.mes_example || '',
      system_prompt: formData.system_prompt || '',
      post_history_instructions: character?.post_history_instructions || '',
      voice_preset: formData.voice_preset || 'female_narrator',
      voice_sample: character?.voice_sample || null,
      avatar: character?.avatar || null,
      tags: character?.tags || [],
      creator: character?.creator || 'User',
      character_version: character?.character_version || '2.0',
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: {
        name: formData.name || character?.name || 'Unnamed Character',
        description: formData.summary || '',
        personality: formData.personality || '',
        scenario: formData.scenario || '',
        first_mes: formData.first_mes || '',
        mes_example: character?.mes_example || '',
        system_prompt: formData.system_prompt || '',
        post_history_instructions: character?.post_history_instructions || '',
        alternate_greetings: character?.alternate_greetings || [],
        tags: character?.tags || [],
        creator: character?.creator || 'User',
        character_version: character?.character_version || '2.0'
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
          summary: validated.summary,
          personality: validated.personality,
          scenario: validated.scenario,
          first_mes: validated.first_mes,
          system_prompt: validated.system_prompt,
          voice_preset: validated.voice_preset
        });

        setValidationSuccess(
          `Successfully validated & imported "${validated.name}" (${validated.specDetected})`
        );
      } catch (err) {
        setValidationError(err.message || 'Failed to parse and validate character JSON.');
      } finally {
        // Reset file input value to allow re-importing the same file if needed
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData, voiceFile, character?.id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editor-form">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
          {character ? `Edit ${character.name}` : 'Create New Character'}
        </h2>
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
          <span style={{ fontSize: '0.8rem', color: '#9ca3af', background: 'var(--bg-card)', padding: '6px 12px', borderRadius: '12px' }}>
            Tavern Spec v2 Format
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

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="form-group">
          <label>Character Name *</label>
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
          <label>Tagline / Summary</label>
          <input 
            type="text" 
            name="summary" 
            className="form-input" 
            value={formData.summary} 
            onChange={handleChange} 
            placeholder="e.g. The world's premier consulting detective." 
          />
        </div>

        <div className="form-group">
          <label>Personality & Behavioral Persona</label>
          <textarea 
            name="personality" 
            className="form-textarea" 
            value={formData.personality} 
            onChange={handleChange} 
            placeholder="Describe behavior, tone of voice, quirks, and mindset..." 
          />
        </div>

        <div className="form-group">
          <label>Scenario / World Setting</label>
          <textarea 
            name="scenario" 
            className="form-textarea" 
            value={formData.scenario} 
            onChange={handleChange} 
            placeholder="The environment, context, current situation, or roleplay premise..." 
          />
        </div>

        <div className="form-group">
          <label>Greeting Message (First Message)</label>
          <textarea 
            name="first_mes" 
            className="form-textarea" 
            value={formData.first_mes} 
            onChange={handleChange} 
            placeholder="The greeting the character sends when a conversation opens..." 
          />
        </div>

        <div className="form-group">
          <label>System Instructions / Roleplay Guidelines</label>
          <textarea 
            name="system_prompt" 
            className="form-textarea" 
            value={formData.system_prompt} 
            onChange={handleChange} 
            placeholder="Custom instructions passed directly to the model..." 
          />
        </div>

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
            <input 
              type="file" 
              accept="audio/*" 
              className="form-input"
              onChange={(e) => setVoiceFile(e.target.files[0])}
            />
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Upload a 3–10 sec audio clip to clone voice</span>
          </div>
        </div>

        <button type="submit" className="submit-btn" disabled={saving} style={{ marginTop: '10px' }}>
          <Save size={18} /> {saving ? 'Saving Character...' : 'Save Character Card'}
        </button>
      </form>
    </div>
  );
}
