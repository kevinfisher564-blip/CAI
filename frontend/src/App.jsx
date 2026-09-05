import React, { useState, useEffect } from 'react';
import { MessageSquare, Edit3, Compass, Users, Sparkles, Plus, MessageSquarePlus } from 'lucide-react';
import CharacterGallery from './components/CharacterGallery';
import CharacterEditor from './components/CharacterEditor';
import ScenarioGallery from './components/ScenarioGallery';
import ScenarioEditor from './components/ScenarioEditor';
import ChatRoom from './components/ChatRoom';
import NewChatModal from './components/NewChatModal';

export default function App() {
  const [characters, setCharacters] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [viewMode, setViewMode] = useState('chat'); // 'chat' | 'characters' | 'scenarios'
  
  // Character management state
  const [selectedCharId, setSelectedCharId] = useState(null);
  const [editingCharacter, setEditingCharacter] = useState(null);

  // Scenario management state
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);
  const [editingScenario, setEditingScenario] = useState(null);

  // Active Chat Session state (Scenario + Room Characters)
  const [activeScenario, setActiveScenario] = useState(null);
  const [activeCharacters, setActiveCharacters] = useState([]);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);

  const fetchCharacters = async () => {
    try {
      const res = await fetch('/api/characters');
      if (res.ok) {
        const data = await res.json();
        setCharacters(data);
        if (data.length > 0 && activeCharacters.length === 0) {
          setActiveCharacters([data[0]]);
          setSelectedCharId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch characters:', err);
    }
  };

  const fetchScenarios = async () => {
    try {
      const res = await fetch('/api/scenarios');
      if (res.ok) {
        const data = await res.json();
        setScenarios(data);
        if (data.length > 0 && !selectedScenarioId) {
          setSelectedScenarioId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch scenarios:', err);
    }
  };

  useEffect(() => {
    fetchCharacters();
    fetchScenarios();
  }, []);

  // Characters Handlers
  const handleSelectCharacter = (id) => {
    setSelectedCharId(id);
    const char = characters.find((c) => c.id === id);
    if (char) {
      setActiveCharacters([char]);
    }
    setViewMode('chat');
  };

  const handleEditCharacter = (char) => {
    setSelectedCharId(char.id);
    setEditingCharacter(char);
    setViewMode('characters');
  };

  const handleCreateNewCharacter = () => {
    setEditingCharacter(null);
    setViewMode('characters');
  };

  const handleImportCharacter = (importedData) => {
    setEditingCharacter(importedData);
    setViewMode('characters');
  };

  const handleSaveCharacter = async (formData, voiceFile, charId) => {
    try {
      let res;
      if (charId) {
        res = await fetch(`/api/characters/${charId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else {
        res = await fetch('/api/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Server returned error status ${res.status}`);
      }

      let savedChar = await res.json();

      if (voiceFile) {
        const voiceData = new FormData();
        voiceData.append('file', voiceFile);
        if (formData.voice_sample_text) {
          voiceData.append('voice_sample_text', formData.voice_sample_text);
        }
        const voiceRes = await fetch(`/api/characters/${savedChar.id}/voice_sample`, {
          method: 'POST',
          body: voiceData
        });
        if (voiceRes.ok) {
          const vData = await voiceRes.json();
          savedChar.voice_sample = vData.voice_sample;
          savedChar.voice_sample_text = vData.voice_sample_text;
        } else {
          console.error('Failed to upload voice sample:', await voiceRes.text());
        }
      }

      await fetchCharacters();
      setSelectedCharId(savedChar.id);
      setActiveCharacters([savedChar]);
      setViewMode('chat');
    } catch (err) {
      console.error('Error saving character:', err);
      throw err;
    }
  };

  // Scenarios Handlers
  const handleSelectScenario = (id) => {
    setSelectedScenarioId(id);
    const sc = scenarios.find((s) => s.id === id);
    setEditingScenario(sc);
  };

  const handleEditScenario = (sc) => {
    setSelectedScenarioId(sc.id);
    setEditingScenario(sc);
    setViewMode('scenarios');
  };

  const handleCreateNewScenario = () => {
    setEditingScenario(null);
    setSelectedScenarioId(null);
    setViewMode('scenarios');
  };

  const handleImportScenario = async (importedData) => {
    try {
      const res = await fetch('/api/scenarios/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importedData)
      });
      if (res.ok) {
        const saved = await res.json();
        await fetchScenarios();
        setSelectedScenarioId(saved.id);
        setEditingScenario(saved);
        setViewMode('scenarios');
      }
    } catch (err) {
      console.error('Error importing scenario:', err);
    }
  };

  const handleSaveScenario = async (formData, scenarioId) => {
    let res;
    if (scenarioId) {
      res = await fetch(`/api/scenarios/${scenarioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
    } else {
      res = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
    }

    if (res.ok) {
      const saved = await res.json();
      await fetchScenarios();
      setSelectedScenarioId(saved.id);
      setEditingScenario(saved);
    } else {
      throw new Error('Failed to save scenario');
    }
  };

  const handleDeleteScenario = async (scenarioId) => {
    try {
      const res = await fetch(`/api/scenarios/${scenarioId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchScenarios();
        if (selectedScenarioId === scenarioId) {
          setSelectedScenarioId(null);
          setEditingScenario(null);
        }
        if (activeScenario?.id === scenarioId) {
          setActiveScenario(null);
        }
      }
    } catch (err) {
      console.error('Error deleting scenario:', err);
    }
  };

  const handleStartChatWithScenario = (scenario) => {
    setActiveScenario(scenario);
    setIsNewChatModalOpen(true);
  };

  // Launch New Chat Room
  const handleLaunchChat = (chosenScenario, chosenCharacters) => {
    setActiveScenario(chosenScenario);
    setActiveCharacters(chosenCharacters);
    if (chosenCharacters.length > 0) {
      setSelectedCharId(chosenCharacters[0].id);
    }
    setViewMode('chat');
  };

  // Send message for a specific character turn
  const handleSendMessage = async (text, imagePreview, previousMessages, respondingChar, roomCharacters, scenario) => {
    let content = text;
    if (imagePreview) {
      content = [
        { type: 'text', text: text || 'What do you see in this image?' },
        { type: 'image_url', image_url: { url: imagePreview } }
      ];
    }

    const payload = {
      character_id: respondingChar.id,
      character_card: respondingChar,
      messages: [...previousMessages, { role: 'user', content: content }],
      scenario: scenario || undefined,
      room_characters: roomCharacters || undefined
    };

    try {
      const res = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error('Chat error:', err);
    }
    return null;
  };

  const handleAudioRecord = async (audioBlob) => {
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.wav');

      const res = await fetch('/api/voice/stt', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        return data.text;
      }
    } catch (err) {
      console.error('STT error:', err);
    }
    return '';
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="brand-header">
          <div className="avatar-circle" style={{ background: 'var(--accent-gradient)' }}>
            <Sparkles size={22} color="#fff" />
          </div>
          <div>
            <div className="brand-title">Character AI</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Multimodal Studio Studio</div>
          </div>
        </div>

        {/* Top-Level Navigation */}
        <div className="nav-section">
          <button 
            type="button"
            className={`nav-button ${viewMode === 'chat' ? 'active' : ''}`}
            onClick={() => setViewMode('chat')}
          >
            <MessageSquare size={18} /> Chat Workspace
          </button>
          <button 
            type="button"
            className={`nav-button ${viewMode === 'characters' ? 'active' : ''}`}
            onClick={() => {
              setEditingCharacter(characters.find((c) => c.id === selectedCharId) || null);
              setViewMode('characters');
            }}
          >
            <Users size={18} /> Character Studio
          </button>
          <button 
            type="button"
            className={`nav-button ${viewMode === 'scenarios' ? 'active' : ''}`}
            onClick={() => {
              setEditingScenario(scenarios.find((s) => s.id === selectedScenarioId) || null);
              setViewMode('scenarios');
            }}
          >
            <Compass size={18} /> Scenario Studio
          </button>
        </div>

        {/* Sidebar Gallery Switcher */}
        {viewMode === 'scenarios' ? (
          <ScenarioGallery 
            scenarios={scenarios}
            selectedId={selectedScenarioId}
            onSelect={handleSelectScenario}
            onEdit={handleEditScenario}
            onCreateNew={handleCreateNewScenario}
            onImport={handleImportScenario}
            onDelete={handleDeleteScenario}
            onStartChatWithScenario={handleStartChatWithScenario}
          />
        ) : (
          <CharacterGallery 
            characters={characters} 
            selectedId={selectedCharId} 
            onSelect={handleSelectCharacter}
            onEdit={handleEditCharacter}
            onCreateNew={handleCreateNewCharacter}
            onImport={handleImportCharacter}
          />
        )}
      </div>

      {/* Main Workspace */}
      <div className="main-workspace">
        {viewMode === 'chat' && (
          <ChatRoom 
            characters={activeCharacters}
            scenario={activeScenario}
            onSendMessage={handleSendMessage}
            onAudioRecord={handleAudioRecord}
            onOpenNewChat={() => setIsNewChatModalOpen(true)}
          />
        )}

        {viewMode === 'characters' && (
          <CharacterEditor 
            character={editingCharacter} 
            onSave={handleSaveCharacter}
          />
        )}

        {viewMode === 'scenarios' && (
          <ScenarioEditor 
            scenario={editingScenario}
            onSave={handleSaveScenario}
            onDelete={handleDeleteScenario}
          />
        )}
      </div>

      {/* New Chat Configuration Modal */}
      <NewChatModal 
        scenarios={scenarios}
        characters={characters}
        initialScenarioId={activeScenario?.id || selectedScenarioId}
        initialCharIds={activeCharacters.map((c) => c.id)}
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onStartChat={handleLaunchChat}
      />
    </div>
  );
}
