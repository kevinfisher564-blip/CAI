import React, { useState, useEffect, useRef } from 'react';
import { Save, Download, FileUp, AlertCircle, CheckCircle2, Trash2, Compass } from 'lucide-react';

export default function ScenarioEditor({ scenario, onSave, onDelete }) {
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    scenario_prompt: '',
    initial_message: '',
    tags: []
  });

  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [validationSuccess, setValidationSuccess] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setValidationError(null);
    setValidationSuccess(null);
    if (scenario) {
      setFormData({
        title: scenario.title || '',
        summary: scenario.summary || '',
        scenario_prompt: scenario.scenario_prompt || '',
        initial_message: scenario.initial_message || '',
        tags: scenario.tags || []
      });
    } else {
      setFormData({
        title: '',
        summary: '',
        scenario_prompt: '',
        initial_message: '',
        tags: []
      });
    }
  }, [scenario]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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

  const getSanitizedFilename = () => {
    const rawTitle = (formData.title || scenario?.title || 'scenario').trim();
    const sanitized = rawTitle
      .toLowerCase()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `${sanitized || 'scenario'}.json`;
  };

  const handleDownloadJson = () => {
    const scenarioData = {
      id: scenario?.id || undefined,
      title: formData.title || 'Untitled Scenario',
      summary: formData.summary || '',
      scenario_prompt: formData.scenario_prompt || '',
      initial_message: formData.initial_message || '',
      tags: formData.tags || [],
      version: '1.0'
    };

    const blob = new Blob([JSON.stringify(scenarioData, null, 2)], { type: 'application/json' });
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
        const data = JSON.parse(content);
        
        setFormData({
          title: data.title || data.name || 'Imported Scenario',
          summary: data.summary || data.description || '',
          scenario_prompt: data.scenario_prompt || data.scenario || data.world_setting || '',
          initial_message: data.initial_message || data.first_mes || '',
          tags: Array.isArray(data.tags) ? data.tags : []
        });

        setValidationSuccess(`Successfully imported "${data.title || data.name || 'Scenario'}"`);
      } catch (err) {
        setValidationError(err.message || 'Failed to parse scenario JSON file.');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setValidationError('Scenario Title is required.');
      return;
    }
    setSaving(true);
    try {
      await onSave(formData, scenario?.id);
      setValidationSuccess('Scenario saved successfully!');
    } catch (err) {
      setValidationError(err.message || 'Failed to save scenario.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editor-form">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="avatar-circle" style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', width: '38px', height: '38px' }}>
            <Compass size={20} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            {scenario ? `Edit ${scenario.title}` : 'Create New Scenario'}
          </h2>
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
            title="Import scenario from a JSON preset file"
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
          {scenario?.id && onDelete && (
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                if (window.confirm(`Delete scenario "${scenario.title}"?`)) {
                  onDelete(scenario.id);
                }
              }}
              style={{ padding: '8px 14px', fontSize: '0.85rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            >
              <Trash2 size={15} /> Delete
            </button>
          )}
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
          <label>Scenario Title *</label>
          <input 
            type="text" 
            name="title" 
            className="form-input" 
            value={formData.title} 
            onChange={handleChange} 
            placeholder="e.g. Neon District Investigation" 
            required 
          />
        </div>

        <div className="form-group">
          <label>Summary / Logline</label>
          <input 
            type="text" 
            name="summary" 
            className="form-input" 
            value={formData.summary} 
            onChange={handleChange} 
            placeholder="e.g. A high-stakes inquiry in the rain-slicked underbelly of Neo-Cascadia." 
          />
        </div>

        <div className="form-group">
          <label>World Setting, Atmosphere & Scene Rules *</label>
          <textarea 
            name="scenario_prompt" 
            className="form-textarea" 
            style={{ minHeight: '140px' }}
            value={formData.scenario_prompt} 
            onChange={handleChange} 
            placeholder="Describe the environment, time period, atmosphere, current dilemma, background lore, and global rules that apply to all characters in this room..." 
            required
          />
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            This context is injected into Tier 1 of the prompt and guides every character participating in the chat.
          </span>
        </div>

        <div className="form-group">
          <label>Initial Scene Hook / Opening Ambient Message (Optional)</label>
          <textarea 
            name="initial_message" 
            className="form-textarea" 
            value={formData.initial_message} 
            onChange={handleChange} 
            placeholder="*Acid rain patters against the metal awning above as the clock tower chimes...*" 
          />
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            Optional ambient opening text displayed at the start of a chat room using this scenario.
          </span>
        </div>

        <div className="form-group">
          <label>Category Tags (Press Enter or comma to add)</label>
          <input 
            type="text" 
            className="form-input" 
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            placeholder="e.g. Cyberpunk, Mystery, Noir, Sci-Fi..." 
          />
          {formData.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {formData.tags.map((tag, idx) => (
                <span 
                  key={idx} 
                  style={{
                    background: 'rgba(6, 182, 212, 0.15)',
                    color: '#06b6d4',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
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
                    style={{ background: 'transparent', border: 'none', color: '#06b6d4', cursor: 'pointer', fontSize: '11px' }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button type="submit" className="submit-btn" disabled={saving} style={{ marginTop: '10px', background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' }}>
          <Save size={18} /> {saving ? 'Saving Scenario...' : 'Save Scenario Preset'}
        </button>
      </form>
    </div>
  );
}
