import React, { useRef } from 'react';
import { Compass, Plus, Edit3, Trash2, FileUp, Play } from 'lucide-react';

export default function ScenarioGallery({ scenarios, selectedId, onSelect, onEdit, onCreateNew, onImport, onDelete, onStartChatWithScenario }) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result;
        const data = JSON.parse(content);
        if (onImport) {
          onImport(data);
        }
      } catch (err) {
        alert(`Failed to import scenario:\n${err.message}`);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="character-list">
      <div 
        className="character-card-item"
        style={{ background: 'rgba(6, 182, 212, 0.1)', borderColor: 'rgba(6, 182, 212, 0.3)' }}
        onClick={onCreateNew}
      >
        <div className="avatar-circle" style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' }}>
          <Plus size={20} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Create New Scenario</div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>World Setting & Situation</div>
        </div>
      </div>

      <div 
        className="character-card-item"
        style={{ background: 'rgba(99, 102, 241, 0.1)', borderColor: 'rgba(99, 102, 241, 0.3)' }}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="avatar-circle" style={{ background: '#6366f1' }}>
          <FileUp size={20} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Import Scenario JSON</div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Load Preset File</div>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          accept=".json,application/json" 
          style={{ display: 'none' }} 
          onChange={handleFileChange}
        />
      </div>

      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', margin: '12px 4px 4px 4px', letterSpacing: '0.05em' }}>
        SAVED SCENARIOS
      </div>

      {scenarios.map((sc) => {
        const isSelected = sc.id === selectedId;

        return (
          <div 
            key={sc.id}
            className={`character-card-item ${isSelected ? 'active' : ''}`}
            onClick={() => onSelect(sc.id)}
            style={isSelected ? { borderColor: '#06b6d4', background: 'rgba(6, 182, 212, 0.15)' } : {}}
          >
            <div className="char-item-info">
              <div className="avatar-circle" style={{ background: 'rgba(6, 182, 212, 0.2)', color: '#06b6d4' }}>
                <Compass size={20} />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {sc.title}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {sc.summary || 'Scenario Preset'}
                </div>
              </div>
            </div>

            <div className="char-card-actions">
              <button
                type="button"
                className="char-action-btn"
                title={`Start Chat in ${sc.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onStartChatWithScenario(sc);
                }}
              >
                <Play size={14} />
              </button>
              <button
                type="button"
                className="char-action-btn"
                title={`Edit ${sc.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(sc);
                }}
              >
                <Edit3 size={14} />
              </button>
              {onDelete && (
                <button
                  type="button"
                  className="char-action-btn"
                  title={`Delete ${sc.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete scenario "${sc.title}"?`)) {
                      onDelete(sc.id);
                    }
                  }}
                >
                  <Trash2 size={14} color="#f87171" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
