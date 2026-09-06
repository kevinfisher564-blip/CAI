import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Mic, 
  Image as ImageIcon, 
  Volume2, 
  VolumeX, 
  Square, 
  Compass, 
  Users, 
  MessageSquarePlus, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight,
  Plus,
  Trash2,
  X,
  Check,
  PauseCircle,
  AtSign,
  Sliders
} from 'lucide-react';

export default function ChatRoom({ 
  characters = [], 
  allCharacters = [],
  character = null, 
  scenario = null, 
  onSendMessage, 
  onAudioRecord,
  onOpenNewChat,
  onUpdateActiveCharacters
}) {
  // Normalize active characters list
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
  
  // Multi-character sequential turn limit (1 to 5, default: 2)
  const [maxSequentialTurns, setMaxSequentialTurns] = useState(() => {
    const saved = localStorage.getItem('cai_max_sequential_turns');
    const parsed = parseInt(saved, 10);
    return !isNaN(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 2;
  });

  // Manage room participants modal state
  const [isManageParticipantsOpen, setIsManageParticipantsOpen] = useState(false);

  // @mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionPopupPos, setMentionPopupPos] = useState({ show: false, index: -1 });
  const [selectedMentionIdx, setSelectedMentionIdx] = useState(0);

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
  const isInterruptedRef = useRef(false);

  // Keep autoSpeakRef in sync
  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
    localStorage.setItem('cai_auto_speak', autoSpeak ? 'true' : 'false');
  }, [autoSpeak]);

  // Persist maxSequentialTurns
  useEffect(() => {
    localStorage.setItem('cai_max_sequential_turns', maxSequentialTurns.toString());
  }, [maxSequentialTurns]);

  // Scroll to bottom on new messages or generation updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating, isPlayingAudio]);

  // Initialize room when active characters or scenario changes
  useEffect(() => {
    stopAudio();
    isInterruptedRef.current = true;
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
        voice_sample_text: char.voice_sample_text,
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

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const stopAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    setIsPlayingAudio(false);
    setActiveSpeaker(null);
  };

  const handleInterrupt = () => {
    isInterruptedRef.current = true;
    stopAudio();
    setIsGenerating(false);
    setCurrentTurnCharacter(null);
  };

  const handleToggleAutoSpeak = () => {
    const nextState = !autoSpeak;
    setAutoSpeak(nextState);
    if (!nextState) {
      stopAudio();
    }
  };

  const playAudioPromise = (text, voicePreset, speakerName, voiceSample, voiceSampleText) => {
    return new Promise(async (resolve) => {
      if (isInterruptedRef.current) {
        resolve();
        return;
      }
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
        if (voiceSampleText) {
          formData.append('voice_sample_text', voiceSampleText);
        }

        const res = await fetch('/api/voice/tts', {
          method: 'POST',
          body: formData
        });

        if (res.ok && !isInterruptedRef.current) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('audio') || contentType.includes('octet-stream')) {
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
            audio.onerror = (e) => {
              console.error('Audio playback error on HTML Audio element:', e);
              setIsPlayingAudio(false);
              setActiveSpeaker(null);
              currentAudioRef.current = null;
              resolve();
            };
            await audio.play();
            return;
          }
        }
        setIsPlayingAudio(false);
        setActiveSpeaker(null);
        resolve();
      } catch (err) {
        console.error('TTS playback error:', err);
        setIsPlayingAudio(false);
        setActiveSpeaker(null);
        resolve();
      }
    });
  };

  const speakSingleMessage = async (text, voicePreset, speakerName, voiceSample, voiceSampleText) => {
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
      if (voiceSampleText) {
        formData.append('voice_sample_text', voiceSampleText);
      }

      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('audio') || contentType.includes('octet-stream')) {
          const blob = await res.blob();
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          currentAudioRef.current = audio;

          audio.onended = () => {
            setIsPlayingAudio(false);
            setActiveSpeaker(null);
            currentAudioRef.current = null;
          };
          audio.onerror = (e) => {
            console.error('Audio playback error on HTML Audio element:', e);
            setIsPlayingAudio(false);
            setActiveSpeaker(null);
            currentAudioRef.current = null;
          };
          await audio.play();
          return;
        }
      }
      setIsPlayingAudio(false);
      setActiveSpeaker(null);
    } catch (err) {
      console.error('TTS speak error:', err);
      setIsPlayingAudio(false);
      setActiveSpeaker(null);
      currentAudioRef.current = null;
    }
  };

  // ---------------------------------------------------------------------------
  // @Mention Detection & Autocomplete Handlers
  // ---------------------------------------------------------------------------
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    if (lastAtIdx !== -1) {
      const query = textBeforeCursor.slice(lastAtIdx + 1);
      // Ensure no spaces or newline before cursor in query
      if (!query.includes(' ') && !query.includes('\n')) {
        setMentionQuery(query);
        setMentionPopupPos({ show: true, index: lastAtIdx });
        setSelectedMentionIdx(0);
        return;
      }
    }

    setMentionPopupPos({ show: false, index: -1 });
    setMentionQuery(null);
  };

  const filteredMentionCandidates = activeCharacters.filter((c) => {
    if (!mentionQuery) return true;
    return c.name.toLowerCase().includes(mentionQuery.toLowerCase());
  });

  const insertMention = (charName) => {
    if (mentionPopupPos.index === -1) return;
    const textBefore = input.slice(0, mentionPopupPos.index);
    const cursorPos = textareaRef.current ? textareaRef.current.selectionStart : input.length;
    const textAfter = input.slice(cursorPos);
    const updated = `${textBefore}@${charName} ${textAfter}`;
    setInput(updated);
    setMentionPopupPos({ show: false, index: -1 });
    setMentionQuery(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // ---------------------------------------------------------------------------
  // Smart Speaker Selection Helper
  // ---------------------------------------------------------------------------
  const selectNextSpeaker = async (history, roomChars, lastSpeakerId = null) => {
    if (!roomChars || roomChars.length === 0) return null;
    if (roomChars.length === 1) return roomChars[0];

    try {
      const res = await fetch('/api/chat/select-speaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          room_characters: roomChars,
          last_speaker_id: lastSpeakerId
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.selected_character) {
          return data.selected_character;
        }
      }
    } catch (err) {
      console.warn('Could not call speaker selector API, falling back to local heuristic:', err);
    }

    // Local fallback: pick a character other than last speaker
    if (lastSpeakerId && roomChars.length > 1) {
      const candidates = roomChars.filter((c) => c.id !== lastSpeakerId);
      return candidates.length > 0 ? candidates[0] : roomChars[0];
    }
    return roomChars[0];
  };

  // ---------------------------------------------------------------------------
  // Multi-Turn C2C Sequential Generation
  // ---------------------------------------------------------------------------
  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isGenerating || activeCharacters.length === 0) return;

    isInterruptedRef.current = false;

    const userMsg = {
      role: 'user',
      sender: 'User',
      content: input,
      imagePreview: imagePreview
    };

    const currentInput = input;
    const currentImage = imagePreview;
    setInput('');
    setSelectedImage(null);
    setImagePreview(null);
    setMentionPopupPos({ show: false, index: -1 });
    if (textareaRef.current) {
      textareaRef.current.style.height = '46px';
    }

    let updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setIsGenerating(true);

    try {
      let turnCount = 0;
      let lastSpeakerId = null;

      // Determine maximum turns for this cycle (1-on-1 chats stop after 1 turn)
      const allowedTurns = activeCharacters.length > 1 ? maxSequentialTurns : 1;

      while (turnCount < allowedTurns && !isInterruptedRef.current) {
        // Step 1: Select the next speaker
        const targetCharacter = await selectNextSpeaker(updatedHistory, activeCharacters, lastSpeakerId);
        if (!targetCharacter || isInterruptedRef.current) break;

        setCurrentTurnCharacter(targetCharacter.name);

        // Step 2: Generate completion for selected character
        const response = await onSendMessage(
          currentInput,
          currentImage,
          updatedHistory,
          targetCharacter,
          activeCharacters,
          scenario
        );

        if (isInterruptedRef.current) break;

        if (response && response.message) {
          const botMsg = {
            role: 'assistant',
            content: response.message.content,
            sender: targetCharacter.name,
            character_id: targetCharacter.id,
            voice_preset: targetCharacter.voice_preset,
            voice_sample: targetCharacter.voice_sample,
            voice_sample_text: targetCharacter.voice_sample_text
          };

          updatedHistory = [...updatedHistory, botMsg];
          setMessages([...updatedHistory]);
          lastSpeakerId = targetCharacter.id;
          turnCount++;

          // Step 3: Speak response if autoSpeak is active
          if (autoSpeakRef.current && !isInterruptedRef.current) {
            await playAudioPromise(
              botMsg.content,
              targetCharacter.voice_preset,
              targetCharacter.name,
              targetCharacter.voice_sample,
              targetCharacter.voice_sample_text
            );
          }
        } else {
          // If no message returned, break the loop
          break;
        }

        // Brief natural pause between character-to-character exchanges
        if (turnCount < allowedTurns && !isInterruptedRef.current) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    } catch (err) {
      console.error('Error during multi-character turn loop:', err);
    } finally {
      setIsGenerating(false);
      setCurrentTurnCharacter(null);
    }
  };

  const handleKeyDown = (e) => {
    // Navigate @mention autocomplete popup
    if (mentionPopupPos.show && filteredMentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIdx((prev) => (prev + 1) % filteredMentionCandidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIdx((prev) => (prev - 1 + filteredMentionCandidates.length) % filteredMentionCandidates.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selectedChar = filteredMentionCandidates[selectedMentionIdx];
        if (selectedChar) {
          insertMention(selectedChar.name);
        }
        return;
      }
      if (e.key === 'Escape') {
        setMentionPopupPos({ show: false, index: -1 });
        return;
      }
    }

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

  const handleToggleRoomParticipant = (char) => {
    if (!onUpdateActiveCharacters) return;
    const isCurrentlyActive = activeCharacters.some((c) => c.id === char.id);
    if (isCurrentlyActive) {
      if (activeCharacters.length === 1) {
        alert('A chat room must have at least one active character.');
        return;
      }
      onUpdateActiveCharacters(activeCharacters.filter((c) => c.id !== char.id));
    } else {
      onUpdateActiveCharacters([...activeCharacters, char]);
    }
  };

  if (activeCharacters.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', gap: '16px' }}>
        <Users size={48} color="#6366f1" style={{ opacity: 0.5 }} />
        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>No active characters in this room</div>
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
    ? activeCharacters.map((c) => c.name).join(', ')
    : activeCharacters[0].name;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Header */}
      <div className="chat-header" style={{ height: 'auto', minHeight: '70px', padding: '12px 24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
          {/* Avatars Stack */}
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: activeCharacters.length > 1 ? '4px' : 0 }}>
            {activeCharacters.slice(0, 4).map((char, idx) => (
              <div 
                key={char.id} 
                className="avatar-circle" 
                style={{ 
                  width: '38px', 
                  height: '38px', 
                  fontSize: '0.9rem',
                  marginLeft: idx > 0 ? '-12px' : 0,
                  border: '2px solid var(--bg-dark)',
                  zIndex: 4 - idx,
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)'
                }}
                title={`${char.name}${char.expertise_keywords?.length ? ` (${char.expertise_keywords.join(', ')})` : ''}`}
              >
                {char.name ? char.name[0].toUpperCase() : 'C'}
              </div>
            ))}
            {activeCharacters.length > 4 && (
              <div 
                className="avatar-circle" 
                style={{ width: '38px', height: '38px', fontSize: '0.75rem', marginLeft: '-12px', background: '#374151', border: '2px solid var(--bg-dark)' }}
              >
                +{activeCharacters.length - 4}
              </div>
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {roomTitle}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>{activeCharacters.length} {activeCharacters.length === 1 ? 'Character' : 'Characters in Room'}</span>
              
              {/* Manage participants trigger */}
              {allCharacters.length > 0 && onUpdateActiveCharacters && (
                <button
                  type="button"
                  onClick={() => setIsManageParticipantsOpen(true)}
                  style={{
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#818cf8',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Add or remove characters in this room"
                >
                  <Users size={12} /> Manage
                </button>
              )}
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
                maxWidth: '220px',
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

        {/* Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Max Sequential Turns Setting */}
          {activeCharacters.length > 1 && (
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                background: 'rgba(255, 255, 255, 0.04)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '8px', 
                padding: '4px 8px',
                fontSize: '0.8rem'
              }}
              title="How many sequential character responses can occur before pausing for user input"
            >
              <Sliders size={13} color="#818cf8" />
              <span style={{ color: '#9ca3af', fontSize: '0.76rem' }}>Max Turns:</span>
              <select
                value={maxSequentialTurns}
                onChange={(e) => setMaxSequentialTurns(parseInt(e.target.value, 10))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#818cf8',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value={1} style={{ background: '#1e293b', color: '#fff' }}>1 turn</option>
                <option value={2} style={{ background: '#1e293b', color: '#fff' }}>2 turns</option>
                <option value={3} style={{ background: '#1e293b', color: '#fff' }}>3 turns</option>
                <option value={4} style={{ background: '#1e293b', color: '#fff' }}>4 turns</option>
                <option value={5} style={{ background: '#1e293b', color: '#fff' }}>5 turns</option>
              </select>
            </div>
          )}

          {/* Interrupt / Pause Button (when generating) */}
          {isGenerating && (
            <button
              type="button"
              className="action-btn"
              onClick={handleInterrupt}
              title="Interrupt and pause character dialogue"
              style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderColor: '#ef4444', fontWeight: 600, fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Square size={14} /> Pause
            </button>
          )}

          <button
            type="button"
            className="secondary-btn"
            onClick={onOpenNewChat}
            title="Start a new chat with different characters or scenario"
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
          >
            <MessageSquarePlus size={15} /> New Chat
          </button>

          {isPlayingAudio && !isGenerating && (
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
            {autoSpeak ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
      </div>

      {/* Messages Viewport */}
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
                    <div className="avatar-circle" style={{ width: '24px', height: '24px', fontSize: '0.72rem', background: '#6366f1' }}>
                      {msg.sender[0].toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#818cf8' }}>
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
                    onClick={() => speakSingleMessage(msg.content, msg.voice_preset, msg.sender, msg.voice_sample, msg.voice_sample_text)}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '12px', width: 'fit-content', gap: '16px' }}>
            <div style={{ fontSize: '0.85rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} className="recording-pulse" style={{ borderRadius: '50%' }} />
              <span>{currentTurnCharacter ? `${currentTurnCharacter} is thinking...` : 'Generating room response...'}</span>
            </div>
            <button
              type="button"
              onClick={handleInterrupt}
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Interrupt character dialogue"
            >
              <PauseCircle size={13} /> Interrupt
            </button>
          </div>
        )}

        {isPlayingAudio && !isGenerating && (
          <div style={{ fontSize: '0.8rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Volume2 size={16} className="recording-pulse" style={{ borderRadius: '50%' }} /> 
            {activeSpeaker ? `${activeSpeaker} is speaking...` : 'Speaking in character...'}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* @Mention Autocomplete Dropdown */}
      {mentionPopupPos.show && filteredMentionCandidates.length > 0 && (
        <div 
          style={{
            position: 'absolute',
            bottom: '75px',
            left: '30px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 100,
            maxWidth: '320px',
            minWidth: '220px',
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AtSign size={12} color="#818cf8" /> Mention Character in Room:
          </div>
          <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
            {filteredMentionCandidates.map((c, idx) => (
              <div
                key={c.id}
                onClick={() => insertMention(c.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  background: idx === selectedMentionIdx ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                  borderLeft: idx === selectedMentionIdx ? '3px solid #6366f1' : '3px solid transparent'
                }}
              >
                <div className="avatar-circle" style={{ width: '22px', height: '22px', fontSize: '0.7rem' }}>
                  {c.name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f3f4f6' }}>{c.name}</div>
                  {c.expertise_keywords && c.expertise_keywords.length > 0 && (
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.expertise_keywords.slice(0, 3).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          onChange={handleInputChange} 
          onKeyDown={handleKeyDown}
          placeholder={activeCharacters.length > 1 ? `Message the room or type @Name to invoke a character...` : `Message ${activeCharacters[0]?.name}...`}
          disabled={isGenerating}
        />

        {isGenerating ? (
          <button 
            type="button" 
            className="action-btn" 
            onClick={handleInterrupt}
            title="Interrupt and Pause"
            style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderColor: '#ef4444' }}
          >
            <Square size={18} />
          </button>
        ) : (
          <button 
            type="button" 
            className="action-btn" 
            onClick={handleSend} 
            title="Send Message"
            disabled={!input.trim() && !selectedImage}
          >
            <Send size={20} />
          </button>
        )}
      </div>

      {/* Manage Room Participants Modal */}
      {isManageParticipantsOpen && (
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setIsManageParticipantsOpen(false)}
        >
          <div 
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '1.1rem' }}>
                <Users size={20} color="#818cf8" /> Room Participants ({activeCharacters.length})
              </div>
              <button
                type="button"
                onClick={() => setIsManageParticipantsOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.84rem', color: '#9ca3af', marginBottom: '16px', lineHeight: 1.4 }}>
              Toggle characters to participate in this group chat room. When multiple characters are present, they will speak to each other based on their areas of interest.
            </p>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', paddingRight: '4px' }}>
              {allCharacters.map((char) => {
                const isActive = activeCharacters.some((c) => c.id === char.id);
                return (
                  <div
                    key={char.id}
                    onClick={() => handleToggleRoomParticipant(char)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      border: isActive ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border-color)',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="avatar-circle" style={{ width: '34px', height: '34px', fontSize: '0.85rem' }}>
                        {char.name ? char.name[0].toUpperCase() : 'C'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f3f4f6' }}>{char.name}</div>
                        {char.expertise_keywords && char.expertise_keywords.length > 0 ? (
                          <div style={{ fontSize: '0.74rem', color: '#34d399' }}>
                            {char.expertise_keywords.join(', ')}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.74rem', color: '#9ca3af' }}>{char.summary || 'No keywords'}</div>
                        )}
                      </div>
                    </div>

                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '6px',
                      border: isActive ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.2)',
                      background: isActive ? '#6366f1' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {isActive && <Check size={14} color="#fff" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="submit-btn"
              onClick={() => setIsManageParticipantsOpen(false)}
              style={{ width: '100%', padding: '10px', justifyContent: 'center' }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
