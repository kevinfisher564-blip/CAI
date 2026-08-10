import React from 'react';
import { UserPlus } from 'lucide-react';

export default function CharacterGallery({ characters, selectedId, onSelect, onCreateNew }) {
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
        );
      })}
    </div>
  );
}
