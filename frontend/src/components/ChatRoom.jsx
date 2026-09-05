import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Image as ImageIcon, Volume2, VolumeX, Square, Compass, Users, MessageSquarePlus, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ChatRoom({ 
  characters = [], 
  character = null, 
  scenario = null, 
  onSendMessage, 
  onAudioRecord,
  onOpenNewChat
}) {
  // Normalize characters list
  const activeCharacters = characters.length > 0 ? characters : (character ? [character] : []);

  const [messages, setMessages] = useState([]);
  const [greetingIndices, setGreetingIndices] = useState({});
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTurnCharacter, setCurrentTurnCharacter] = useState(null);
  
  // Persist autoSpeak preference in localStorage across sessions
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

  // Keep autoSpeakRef in sync
  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
    localStorage.setItem('cai_auto_speak', autoSpeak ? 'true' : 'false');
  }, [autoSpeak]);

  // Initialize room when active characters or scenario changes
  useEffect(() => {
    stopAudio();
    const initialMsgs = [];
    const initialIndices = {};

    // Optional ambient scenario narrative hook
    if (scenario && scenario.initial_message) {
      initialMsgs.push({
        role: 'system',
        content: scenario.initial_message,
        isScenarioHook: true
      });
    }

    // Opening greetings from participating characters
    activeCharacters.forEach((char) => {
      initialIndices[char.id] = 0;
      initialMsgs.push({
        role: 'assistant',
        content: char.first_mes || `Hello! I am ${char.name}.`,
        sender: char.name,
        character_id: char.id,
        voice_preset: char.voice_preset,
        voice_sample: char.voice_sample,
        isInitialGreeting: true
      });
    });

    setGreetingIndices(initialIndices);
    setMessages(initialMsgs);
  }, [scenario?.id, activeCharacters.map((c) => c.id).join(',')]);

  const handleSwipeGreeting = (charId, direction) => {
    const char = activeCharacters.find((c) => c.id === charId);
    if (!char) return;
    const allGreetings = [char.first_mes || `Hello! I am ${char.name}.`, ...(char.alternate_greetings || [])];
    if (allGreetings.length <= 1) return;

    const currentIndex = greetingIndices[charId] || 0;
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = allGreetings.length - 1;
    if (newIndex >= allGreetings.length) newIndex = 0;

    setGreetingIndices((prev) => ({ ...prev, [charId]: newIndex }));

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.isInitialGreeting && msg.character_id === charId) {
          return { ...msg, content: allGreetings[newIndex] };
        }
        return msg;
      })
    );
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

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
    setActiveSpeaker(null);
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

  // Sequential audio playback helper
  const playAudioPromise = (text, voicePreset, speakerName, voiceSample) => {
    return new Promise(async (resolve) => {
      if (!autoSpeakRef.current) return resolve();
      stopAudio();
      setIsPlayingAudio(true);
      setActiveSpeaker(speakerName);

      try {
        const formData = new FormData();
        formData.append('text', text);
        formData.append('voice_preset', voicePreset || 'female_narrator');
        if (voiceSample) {
          formData.append('voice_sample_path', voiceSample);
        }

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
            setActiveSpeaker(null);
            currentAudioRef.current = null;
            resolve();
          };
          audio.onerror = () => {
            setIsPlayingAudio(false);
            setActiveSpeaker(null);
            currentAudioRef.current = null;
            resolve();
          };
          await audio.play();
        } else {
          setIsPlayingAudio(false);
          setActiveSpeaker(null);
          resolve();
        }
      } catch (err) {
        console.error('Audio playback error:', err);
        setIsPlayingAudio(false);
        setActiveSpeaker(null);
        resolve();
      }
    });
  };

  const speakSingleMessage = async (text, voicePreset, speakerName, voiceSample) => {
    stopAudio();
    setIsPlayingAudio(true);
    setActiveSpeaker(speakerName);
    try {
      const formData = new FormData();
      formData.append('text', text);
      formData.append('voice_preset', voicePreset || 'female_narrator');
      if (voiceSample) {
        formData.append('voice_sample_path', voiceSample);
      }

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
          setActiveSpeaker(null);
          currentAudioRef.current = null;
        };
        audio.onerror = () => {
          setIsPlayingAudio(false);
          setActiveSpeaker(null);
          currentAudioRef.current = null;
        };
        await audio.play();
      } else {
        setIsPlayingAudio(false);
        setActiveSpeaker(null);
      }
    } catch (err) {
      console.error('Audio playback error:', err);
      setIsPlayingAudio(false);
      setActiveSpeaker(null);
      currentAudioRef.current = null;
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isGenerating || activeCharacters.length === 0) return;

    const userMsg = {
      role: 'user',
      content: input,
      imagePreview: imagePreview
    };

    const currentInput = input;
    const currentImage = imagePreview;
    setInput('');
    setSelectedImage(null);
    setImagePreview(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = '46px';
    }

    let updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setIsGenerating(true);

    // Multi-Character Round-Robin Turn Generation
    try {
      for (const char of activeCharacters) {
        setCurrentTurnCharacter(char.name);

        const response = await onSendMessage(
          currentInput,
          currentImage,
          updatedHistory,
          char,
          activeCharacters,
          scenario
        );

        if (response && response.message) {
          const botMsg = {
            role: 'assistant',
            content: response.message.content,
            sender: char.name,
            character_id: char.id,
            voice_preset: char.voice_preset,
            voice_sample: char.voice_sample
          };
          updatedHistory = [...updatedHistory, botMsg];
          setMessages([...updatedHistory]);

          // Play voice sequentially for this character if auto-speak is enabled
          if (autoSpeakRef.current) {
            await playAudioPromise(botMsg.content, char.voice_preset, char.name, char.voice_sample);
          }
        }
      }
    } catch (err) {
      console.error('Error during round-robin generation:', err);
    } finally {
      setIsGenerating(false);
      setCurrentTurnCharacter(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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

  if (activeCharacters.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', gap: '16px' }}>
        <Users size={48} color="#6366f1" style={{ opacity: 0.5 }} />
        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>No active characters selected</div>
        <button 
          type="button" 
          className="submit-btn" 
          onClick={onOpenNewChat}
          style={{ padding: '10px 20px', fontSize: '0.9rem' }}
        >
          <Sparkles size={16} /> Configure New Chat Room
        </button>
      </div>
    );
  }

  const roomTitle = activeCharacters.length > 1
    ? activeCharacters.map((c) => c.name).join(' & ')
    : activeCharacters[0].name;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="chat-header" style={{ height: 'auto', minHeight: '70px', padding: '12px 24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
          {/* Avatar(s) Stack */}
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: activeCharacters.length > 1 ? '4px' : 0 }}>
            {activeCharacters.slice(0, 3).map((char, idx) => (
              <div 
                key={char.id} 
                className="avatar-circle" 
                style={{ 
                  width: '38px', 
                  height: '38px', 
                  fontSize: '0.9rem',
                  marginLeft: idx > 0 ? '-12px' : 0,
                  border: '2px solid var(--bg-dark)',
                  zIndex: 3 - idx
                }}
              >
                {char.name ? char.name[0].toUpperCase() : 'C'}
              </div>
            ))}
            {activeCharacters.length > 3 && (
              <div 
                className="avatar-circle" 
                style={{ width: '38px', height: '38px', fontSize: '0.75rem', marginLeft: '-12px', background: '#374151', border: '2px solid var(--bg-dark)' }}
              >
                +{activeCharacters.length - 3}
              </div>
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {roomTitle}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{activeCharacters.length} {activeCharacters.length === 1 ? 'Participant' : 'Participants'} (Round Robin)</span>
            </div>
          </div>

          {/* Scenario Badge */}
          {scenario && (
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(6, 182, 212, 0.12)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                color: '#06b6d4',
                padding: '4px 10px',
                borderRadius: '16px',
                fontSize: '0.8rem',
                fontWeight: 600,
                maxWidth: '260px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              title={scenario.scenario_prompt}
            >
              <Compass size={14} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{scenario.title}</span>
            </div>
          )}
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="secondary-btn"
            onClick={onOpenNewChat}
            title="Start a new chat with different characters or scenario"
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <MessageSquarePlus size={16} /> New Chat
          </button>

          {isPlayingAudio && (
            <button
              type="button"
              className="action-btn"
              onClick={stopAudio}
              title={`Stop voice (${activeSpeaker || 'Audio'})`}
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
        {messages.map((msg, idx) => {
          if (msg.role === 'system') {
            return (
              <div 
                key={idx} 
                style={{
                  alignSelf: 'center',
                  background: 'rgba(6, 182, 212, 0.08)',
                  border: '1px solid rgba(6, 182, 212, 0.25)',
                  color: '#cbd5e1',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  fontStyle: 'italic',
                  maxWidth: '85%',
                  textAlign: 'center',
                  lineHeight: 1.5
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#06b6d4', fontWeight: 600, marginBottom: '2px', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Compass size={13} /> Scene Setting
                </div>
                {msg.content}
              </div>
            );
          }

          const isUser = msg.role === 'user';

          return (
            <div key={idx} className={`message-bubble message-${msg.role}`}>
              {!isUser && msg.sender && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div className="avatar-circle" style={{ width: '22px', height: '22px', fontSize: '0.7rem' }}>
                      {msg.sender[0].toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#818cf8' }}>
                      {msg.sender}
                    </span>
                  </div>

                  {msg.isInitialGreeting && (() => {
                    const charObj = activeCharacters.find((c) => c.id === msg.character_id);
                    const totalGreetings = 1 + (charObj?.alternate_greetings?.length || 0);
                    if (totalGreetings <= 1) return null;
                    const currentIdx = greetingIndices[msg.character_id] || 0;

                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '2px 6px', fontSize: '0.75rem', color: '#9ca3af' }}>
                        <button
                          type="button"
                          onClick={() => handleSwipeGreeting(msg.character_id, -1)}
                          title="Previous alternate greeting swipe"
                          style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <ChevronLeft size={13} />
                        </button>
                        <span>{currentIdx + 1} / {totalGreetings}</span>
                        <button
                          type="button"
                          onClick={() => handleSwipeGreeting(msg.character_id, 1)}
                          title="Next alternate greeting swipe"
                          style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {msg.imagePreview && (
                <img 
                  src={msg.imagePreview} 
                  alt="User Upload" 
                  style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', marginBottom: '8px' }} 
                />
              )}

              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>

              {!isUser && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    type="button"
                    title={`Speak in ${msg.sender || 'character'}'s voice`}
                    onClick={() => speakSingleMessage(msg.content, msg.voice_preset, msg.sender, msg.voice_sample)}
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
          );
        })}

        {isGenerating && (
          <div style={{ fontSize: '0.85rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', width: 'fit-content' }}>
            <Sparkles size={16} className="recording-pulse" style={{ borderRadius: '50%' }} />
            {currentTurnCharacter ? `${currentTurnCharacter} is thinking...` : 'Generating room response...'}
          </div>
        )}

        {isPlayingAudio && (
          <div style={{ fontSize: '0.8rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Volume2 size={16} className="recording-pulse" style={{ borderRadius: '50%' }} /> 
            {activeSpeaker ? `${activeSpeaker} is speaking...` : 'Speaking in character...'}
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
          placeholder={`Message the room (${activeCharacters.map((c) => c.name).join(', ')})...`}
          disabled={isGenerating}
        />

        <button 
          type="button" 
          className="action-btn" 
          onClick={handleSend} 
          title="Send Message"
          disabled={isGenerating}
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
