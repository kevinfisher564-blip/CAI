import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Image as ImageIcon, Volume2, BookOpen, User } from 'lucide-react';

export default function ChatRoom({ character, onSendMessage, onAudioRecord }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);

  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    if (character) {
      setMessages([
        {
          role: 'assistant',
          content: character.first_mes || `Hello! I am ${character.name}.`,
          sender: character.name
        }
      ]);
    }
  }, [character]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    const response = await onSendMessage(currentInput, currentImage, messages);
    if (response && response.message) {
      const botMsg = {
        role: 'assistant',
        content: response.message.content,
        sender: character.name
      };
      setMessages((prev) => [...prev, botMsg]);

      if (autoSpeak) {
        speakResponse(botMsg.content);
      }
    }
  };

  const speakResponse = async (text) => {
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
        audio.onended = () => setIsPlayingAudio(false);
        audio.play();
      } else {
        setIsPlayingAudio(false);
      }
    } catch (err) {
      console.error('Audio playback error:', err);
      setIsPlayingAudio(false);
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
          <button 
            className={`action-btn ${autoSpeak ? 'active' : ''}`}
            onClick={() => setAutoSpeak(!autoSpeak)}
            title={autoSpeak ? 'Auto Voice Response: Enabled' : 'Auto Voice Response: Disabled'}
            style={autoSpeak ? { background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', borderColor: '#6366f1' } : {}}
          >
            <Volume2 size={20} />
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
            <div>{msg.content}</div>
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
          <div style={{ position: 'relative', marginRight: '8px' }}>
            <img src={imagePreview} alt="Preview" style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
            <button 
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
          className={`action-btn ${isRecording ? 'recording-pulse' : ''}`}
          onClick={toggleRecording}
          title={isRecording ? 'Stop Recording' : 'Push to Talk (STT Mic)'}
        >
          <Mic size={20} />
        </button>

        <input 
          type="text" 
          className="text-input" 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={`Chat with ${character.name}...`}
        />

        <button className="action-btn" onClick={handleSend} title="Send Message">
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
