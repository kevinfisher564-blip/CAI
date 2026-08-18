import React, { useState } from 'react';
import { Compass, Users, Check, X, Sparkles, MessageSquare } from 'lucide-react';

export default function NewChatModal({ 
  scenarios, 
  characters, 
  initialScenarioId = null, 
  initialCharIds = [], 
  isOpen, 
  onClose, 
  onStartChat 
}) {
  const [selectedScenarioId, setSelectedScenarioId] = useState(initialScenarioId || (scenarios.length > 0 ? scenarios[0].id : null));
  const [selectedCharIds, setSelectedCharIds] = useState(initialCharIds.length > 0 ? initialCharIds : (characters.length > 0 ? [characters[0].id] : []));

  if (!isOpen) return null;

  const toggleCharacter = (id) => {
    if (selectedCharIds.includes(id)) {
      if (selectedCharIds.length > 1) {
        setSelectedCharIds(selectedCharIds.filter((cid) => cid !== id));
      }
    } else {
      setSelectedCharIds([...selectedCharIds, id]);
    }
  };

  const handleLaunch = () => {
    if (selectedCharIds.length === 0) {
      alert('Please select at least one character for this chat.');
      return;
    }
    const chosenScenario = scenarios.find((s) => s.id === selectedScenarioId) || null;
    const chosenCharacters = characters.filter((c) => selectedCharIds.includes(c.id));
    onStartChat(chosenScenario, chosenCharacters);
    onClose();
  };

  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId);

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="avatar-circle" style={{ width: '36px', height: '36px', background: 'var(--accent-gradient)' }}>
              <MessageSquare size={18} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Start New Chat Room</h3>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Configure your scene setting and character participants</div>
            </div>
          </div>
          <button 
            type="button" 
            className="char-action-btn" 
            onClick={onClose}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* 1. Scenario Selection */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Compass size={18} color="#06b6d4" />
              <label style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f3f4f6' }}>
                1. Select Scene / World Scenario
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
              <div 
                className={`scenario-choice-card ${selectedScenarioId === null ? 'selected' : ''}`}
                onClick={() => setSelectedScenarioId(null)}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', color: '#f3f4f6' }}>
                  Freeform / No Scenario
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                  Pure character interaction without global situation rules.
                </div>
                {selectedScenarioId === null && <div className="scenario-check"><Check size={14} /></div>}
              </div>

              {scenarios.map((sc) => {
                const isSelected = sc.id === selectedScenarioId;
                return (
                  <div 
                    key={sc.id}
                    className={`scenario-choice-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedScenarioId(sc.id)}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', color: '#f3f4f6' }}>
                      {sc.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.3 }}>
                      {sc.summary || 'World Setting'}
                    </div>
                    {isSelected && <div className="scenario-check"><Check size={14} /></div>}
                  </div>
                );
              })}
            </div>

            {selectedScenario && (
              <div style={{ marginTop: '10px', padding: '10px 14px', background: 'rgba(6, 182, 212, 0.08)', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.2)', fontSize: '0.82rem', color: '#cbd5e1' }}>
                <span style={{ color: '#06b6d4', fontWeight: 600 }}>Active Rules: </span>
                {selectedScenario.scenario_prompt}
              </div>
            )}
          </div>

          {/* 2. Character Selection */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} color="#818cf8" />
                <label style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f3f4f6' }}>
                  2. Select Characters in the Room ({selectedCharIds.length} Selected)
                </label>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                Pick 1 or multiple for multi-character round-robin chat
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
              {characters.map((char) => {
                const isSelected = selectedCharIds.includes(char.id);
                const initial = char.name ? char.name[0].toUpperCase() : 'C';

                return (
                  <div 
                    key={char.id}
                    className={`scenario-choice-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleCharacter(char.id)}
                    style={isSelected ? { borderColor: '#6366f1', background: 'rgba(99, 102, 241, 0.15)' } : {}}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="avatar-circle" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>
                        {initial}
                      </div>
                      <div style={{ overflow: 'hidden', flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {char.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {char.summary || 'Character'}
                        </div>
                      </div>
                    </div>
                    {isSelected && <div className="scenario-check" style={{ background: '#6366f1' }}><Check size={14} /></div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button 
            type="button" 
            className="submit-btn" 
            onClick={handleLaunch}
            disabled={selectedCharIds.length === 0}
            style={{ padding: '12px 24px' }}
          >
            <Sparkles size={18} /> Start Chat ({selectedCharIds.length} {selectedCharIds.length === 1 ? 'Character' : 'Characters'})
          </button>
        </div>
      </div>
    </div>
  );
}
