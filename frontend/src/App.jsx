import React, { useState, useEffect } from 'react';
import { MessageSquare, Edit3, Sparkles } from 'lucide-react';
import CharacterGallery from './components/CharacterGallery';
import CharacterEditor from './components/CharacterEditor';
import ChatRoom from './components/ChatRoom';

export default function App() {
  const [characters, setCharacters] = useState([]);
  const [selectedCharId, setSelectedCharId] = useState(null);
  const [viewMode, setViewMode] = useState('chat'); // 'chat' or 'editor'
  const [editingCharacter, setEditingCharacter] = useState(null);

  const fetchCharacters = async () => {
    try {
      const res = await fetch('/api/characters');
      if (res.ok) {
        const data = await res.json();
        setCharacters(data);
        if (data.length > 0 && !selectedCharId) {
          setSelectedCharId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch characters:', err);
    }
  };

  useEffect(() => {
    fetchCharacters();
  }, []);

  const selectedCharacter = characters.find((c) => c.id === selectedCharId);

  const handleSelectCharacter = (id) => {
    setSelectedCharId(id);
    setViewMode('chat');
  };

  const handleCreateNew = () => {
    setEditingCharacter(null);
    setViewMode('editor');
  };

  const handleEditCurrent = () => {
    setEditingCharacter(selectedCharacter);
    setViewMode('editor');
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

      if (res.ok) {
        const savedChar = await res.json();

        if (voiceFile) {
          const voiceData = new FormData();
          voiceData.append('file', voiceFile);
          await fetch(`/api/characters/${savedChar.id}/voice_sample`, {
            method: 'POST',
            body: voiceData
          });
        }

        await fetchCharacters();
        setSelectedCharId(savedChar.id);
        setViewMode('chat');
      }
    } catch (err) {
      console.error('Error saving character:', err);
    }
  };

  const handleSendMessage = async (text, imagePreview, previousMessages) => {
    if (!selectedCharacter) return null;

    let content = text;
    if (imagePreview) {
      content = [
        { type: 'text', text: text || 'What do you see in this image?' },
        { type: 'image_url', image_url: { url: imagePreview } }
      ];
    }

    const payload = {
      character_id: selectedCharacter.id,
      messages: [...previousMessages, { role: 'user', content: content }],
      character_card: selectedCharacter
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
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Local Studio Studio</div>
          </div>
        </div>

        <div className="nav-section">
          <button 
            className={`nav-button ${viewMode === 'chat' ? 'active' : ''}`}
            onClick={() => setViewMode('chat')}
          >
            <MessageSquare size={18} /> Chat Workspace
          </button>
          <button 
            className={`nav-button ${viewMode === 'editor' ? 'active' : ''}`}
            onClick={handleEditCurrent}
          >
            <Edit3 size={18} /> Character Editor
          </button>
        </div>

        <CharacterGallery 
          characters={characters} 
          selectedId={selectedCharId} 
          onSelect={handleSelectCharacter}
          onCreateNew={handleCreateNew}
        />
      </div>

      {/* Main Workspace */}
      <div className="main-workspace">
        {viewMode === 'chat' ? (
          <ChatRoom 
            character={selectedCharacter} 
            onSendMessage={handleSendMessage}
            onAudioRecord={handleAudioRecord}
          />
        ) : (
          <CharacterEditor 
            character={editingCharacter} 
            onSave={handleSaveCharacter}
          />
        )}
      </div>
    </div>
  );
}
