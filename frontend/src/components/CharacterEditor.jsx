import React, { useState, useEffect } from 'react';
import { Save, Upload, Volume2 } from 'lucide-react';

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

  useEffect(() => {
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
          {character ? `Edit ${character.name}` : 'Create New Character'}
        </h2>
        <span style={{ fontSize: '0.8rem', color: '#9ca3af', background: 'var(--bg-card)', padding: '4px 12px', borderRadius: '12px' }}>
          Tavern Spec v2 Format
        </span>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="form-group">
          <label>Character Name</label>
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

        <button type="submit" className="submit-btn" disabled={saving} style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Save size={18} /> {saving ? 'Saving Character...' : 'Save Character Card'}
        </button>
      </form>
    </div>
  );
}
