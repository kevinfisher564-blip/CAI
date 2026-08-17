import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Image as ImageIcon, Volume2, VolumeX, Square } from 'lucide-react';

export default function ChatRoom({ character, onSendMessage, onAudioRecord }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  
  // Persist autoSpeak preference in localStorage across character switches & reloads
  const [autoSpeak, setAutoSpeak] = useState(() => {
    const saved = localStorage.getItem('cai_auto_speak');
    return saved !== null ? saved === 'true' : true;
  });

  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const textareaRef = useRef(null);
  const currentAudioRef = useRef(null);
  const autoSpeakRef = useRef(autoSpeak);

  // Keep autoSpeakRef in sync with state and persist to localStorage
  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
    localStorage.setItem('cai_auto_speak', autoSpeak ? 'true' : 'false');
  }, [autoSpeak]);

  useEffect(() => {
    if (character) {
      setMessages([
        {
          role: 'assistant',
          content: character.first_mes || `Hello! I am ${character.name}.`,
          sender: character.name
        }
      ]);
      // Stop any previously playing audio when switching characters
      stopAudio();
    }
  }, [character]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 46), 220)}px`;
    }
  }, [input]);

  const stopAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsPlayingAudio(false);
  };

  const handleToggleAutoSpeak = () => {
    setAutoSpeak((prev) => {
      const next = !prev;
      if (!next) {
        stopAudio();
      }
      return next;
    });
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && !selectedImage) return;

    const userMsg = {
      role: 'user',
      content: input,
      imagePreview: imagePreview
    };

    setMessages((prev) => [...prev, userMsg]);

    const currentInput = input;
    const currentImage = imagePreview;
    setInput('');
    setSelectedImage(null);
    setImagePreview(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = '46px';
    }

    const response = await onSendMessage(currentInput, currentImage, messages);
    if (response && response.message) {
      const botMsg = {
        role: 'assistant',
        content: response.message.content,
        sender: character.name
      };
      setMessages((prev) => [...prev, botMsg]);

      // Use ref to read latest toggle state (prevents async closure bugs)
      if (autoSpeakRef.current) {
        speakResponse(botMsg.content);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const speakResponse = async (text) => {
    stopAudio();
    setIsPlayingAudio(true);
    try {
      const formData = new FormData();
      formData.append('text', text);
      formData.append('voice_preset', character?.voice_preset || 'female_narrator');

      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;

        audio.onended = () => {
          setIsPlayingAudio(false);
          currentAudioRef.current = null;
        };
        audio.onerror = () => {
          setIsPlayingAudio(false);
          currentAudioRef.current = null;
        };
        await audio.play();
      } else {
        setIsPlayingAudio(false);
      }
    } catch (err) {
      console.error('Audio playback error:', err);
      setIsPlayingAudio(false);
      currentAudioRef.current = null;
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          const transcribedText = await onAudioRecord(audioBlob);
          if (transcribedText) {
            setInput(transcribedText);
          }
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
      } catch (err) {
        alert('Microphone access denied or unavailable.');
      }
    }
  };

  if (!character) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
        Select a character from the sidebar to begin chatting.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="avatar-circle">
            {character.name ? character.name[0].toUpperCase() : 'C'}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{character.name}</div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{character.summary || 'Roleplay Character'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isPlayingAudio && (
            <button
              type="button"
              className="action-btn"
              onClick={stopAudio}
              title="Stop voice audio"
              style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderColor: '#ef4444' }}
            >
              <Square size={16} />
            </button>
          )}

          <button 
            type="button"
            className={`action-btn ${autoSpeak ? 'active' : ''}`}
            onClick={handleToggleAutoSpeak}
            title={autoSpeak ? 'Auto Voice: Enabled (Click to Mute)' : 'Auto Voice: Disabled (Click to Enable)'}
            style={
              autoSpeak 
                ? { background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', borderColor: '#6366f1' } 
                : { color: '#6b7280', borderColor: 'rgba(255, 255, 255, 0.1)', background: 'transparent' }
            }
          >
            {autoSpeak ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message-bubble message-${msg.role}`}>
            {msg.imagePreview && (
              <img 
                src={msg.imagePreview} 
                alt="User Upload" 
                style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', marginBottom: '8px' }} 
              />
            )}
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>
            {msg.role === 'assistant' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  title="Play Voice"
                  onClick={() => speakResponse(msg.content)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    opacity: 0.7,
                    transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                >
                  <Volume2 size={13} /> Speak
                </button>
              </div>
            )}
          </div>
        ))}
        {isPlayingAudio && (
          <div style={{ fontSize: '0.8rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Volume2 size={16} className="recording-pulse" style={{ borderRadius: '50%' }} /> Speaking in character...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="chat-input-bar">
        {imagePreview && (
          <div style={{ position: 'relative', marginRight: '4px', alignSelf: 'center' }}>
            <img src={imagePreview} alt="Preview" style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
            <button 
              type="button"
              onClick={() => { setSelectedImage(null); setImagePreview(null); }}
              style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        )}

        <label className="action-btn" title="Attach Image for Vision Reaction">
          <ImageIcon size={20} />
          <input type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
        </label>

        <button 
          type="button"
          className={`action-btn ${isRecording ? 'recording-pulse' : ''}`}
          onClick={toggleRecording}
          title={isRecording ? 'Stop Recording' : 'Push to Talk (STT Mic)'}
        >
          <Mic size={20} />
        </button>

        <textarea 
          ref={textareaRef}
          className="text-input chat-textarea" 
          rows={1}
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          onKeyDown={handleKeyDown}
          placeholder={`Chat with ${character.name}... (Enter to send, Shift+Enter for new line)`}
        />

        <button type="button" className="action-btn" onClick={handleSend} title="Send Message">
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
