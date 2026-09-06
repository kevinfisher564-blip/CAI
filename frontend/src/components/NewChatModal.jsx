import React, { useState, useEffect } from 'react';
import { Compass, Users, Check, X, Sparkles, MessageSquare } from 'lucide-react';

export default function NewChatModal({ 
  scenarios = [], 
  characters = [], 
  initialScenarioId = null, 
  initialCharIds = [], 
  isOpen, 
  onClose, 
  onStartChat 
}) {
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);
  const [selectedCharIds, setSelectedCharIds] = useState([]);

  // Synchronize selection state whenever the modal opens or props update
  useEffect(() => {
    if (isOpen) {
      // Initialize scenario
      if (initialScenarioId !== undefined && initialScenarioId !== null) {
        setSelectedScenarioId(initialScenarioId);
      } else if (scenarios.length > 0) {
        setSelectedScenarioId(scenarios[0].id);
      } else {
        setSelectedScenarioId(null);
      }

      // Initialize character selections
      if (initialCharIds && initialCharIds.length > 0) {
        setSelectedCharIds(initialCharIds);
      } else if (characters.length > 0) {
        setSelectedCharIds([characters[0].id]);
      } else {
        setSelectedCharIds([]);
      }
    }
  }, [isOpen, initialScenarioId, initialCharIds, scenarios, characters]);

  if (!isOpen) return null;

  const toggleCharacter = (id) => {
    setSelectedCharIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((cid) => cid !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAllCharacters = () => {
    setSelectedCharIds(characters.map((c) => c.id));
  };

  const handleDeselectAllCharacters = () => {
    setSelectedCharIds([]);
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
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

        {/* Modal Body */}
        <div className="modal-body">
          {/* Step 1: Scenario Selection */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Compass size={18} color="#06b6d4" />
              <label style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f3f4f6' }}>
                1. Select Scene / World Scenario
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
              <div 
                className={`scenario-choice-card ${selectedScenarioId === null ? 'selected' : ''}`}
                onClick={() => setSelectedScenarioId(null)}
                style={{ cursor: 'pointer' }}
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
                    style={{ cursor: 'pointer' }}
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

          {/* Step 2: Character Selection */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} color="#818cf8" />
                <label style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f3f4f6' }}>
                  2. Select Characters in the Room ({selectedCharIds.length} Selected)
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleSelectAllCharacters}
                  style={{
                    background: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#818cf8',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    cursor: 'pointer'
                  }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllCharacters}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-color)',
                    color: '#9ca3af',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
              {characters.map((char) => {
                const isSelected = selectedCharIds.includes(char.id);
                const initial = char.name ? char.name[0].toUpperCase() : 'C';

                return (
                  <div 
                    key={char.id}
                    className={`scenario-choice-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleCharacter(char.id)}
                    style={{
                      cursor: 'pointer',
                      borderColor: isSelected ? '#6366f1' : 'var(--border-color)',
                      background: isSelected ? 'rgba(99, 102, 241, 0.16)' : 'var(--bg-card)',
                      transition: 'all 0.15s ease',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div 
                        className="avatar-circle" 
                        style={{ 
                          width: '34px', 
                          height: '34px', 
                          fontSize: '0.85rem',
                          background: isSelected ? '#6366f1' : 'rgba(255, 255, 255, 0.1)'
                        }}
                      >
                        {initial}
                      </div>
                      <div style={{ overflow: 'hidden', flex: 1, paddingRight: '16px' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {char.name}
                        </div>
                        {char.expertise_keywords && char.expertise_keywords.length > 0 ? (
                          <div style={{ fontSize: '0.72rem', color: '#34d399', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {char.expertise_keywords.join(', ')}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.72rem', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {char.summary || 'Character'}
                          </div>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div 
                        className="scenario-check" 
                        style={{ background: '#6366f1' }}
                      >
                        <Check size={14} color="#fff" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button 
            type="button" 
            className="submit-btn" 
            onClick={handleLaunch}
            disabled={selectedCharIds.length === 0}
            style={{ 
              padding: '12px 24px',
              opacity: selectedCharIds.length === 0 ? 0.5 : 1,
              cursor: selectedCharIds.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <Sparkles size={18} /> Start Chat ({selectedCharIds.length} {selectedCharIds.length === 1 ? 'Character' : 'Characters'})
          </button>
        </div>
      </div>
    </div>
  );
}
