import React, { useRef } from 'react';
import { UserPlus, MessageSquare, Edit3, FileUp } from 'lucide-react';
import { validateAndParseCharacterJson } from '../utils/characterValidator';

export default function CharacterGallery({ characters, selectedId, onSelect, onEdit, onCreateNew, onImport }) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result;
        const validated = validateAndParseCharacterJson(content);
        if (onImport) {
          onImport(validated);
        }
      } catch (err) {
        alert(`Failed to import character:\n${err.message}`);
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
        style={{ background: 'rgba(99, 102, 241, 0.1)', borderColor: 'rgba(99, 102, 241, 0.3)' }}
        onClick={onCreateNew}
      >
        <div className="avatar-circle" style={{ background: '#6366f1' }}>
          <UserPlus size={20} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Create New Character</div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Visual Card Editor</div>
        </div>
      </div>

      <div 
        className="character-card-item"
        style={{ background: 'rgba(6, 182, 212, 0.1)', borderColor: 'rgba(6, 182, 212, 0.3)' }}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="avatar-circle" style={{ background: '#06b6d4' }}>
          <FileUp size={20} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Import Character JSON</div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Tavern & CAI Format</div>
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
        PRE-DEFINED CHARACTERS
      </div>

      {characters.map((char) => {
        const isSelected = char.id === selectedId;
        const initial = char.name ? char.name[0].toUpperCase() : 'C';

        return (
          <div 
            key={char.id}
            className={`character-card-item ${isSelected ? 'active' : ''}`}
            onClick={() => onSelect(char.id)}
            style={isSelected ? { borderColor: '#6366f1', background: 'rgba(99, 102, 241, 0.15)' } : {}}
          >
            <div className="char-item-info">
              <div className="avatar-circle">
                {initial}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {char.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {char.summary || char.personality || 'Character'}
                </div>
              </div>
            </div>

            <div className="char-card-actions">
              <button
                type="button"
                className="char-action-btn"
                title={`Chat with ${char.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(char.id);
                }}
              >
                <MessageSquare size={15} />
              </button>
              <button
                type="button"
                className="char-action-btn"
                title={`Edit ${char.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(char);
                }}
              >
                <Edit3 size={15} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
