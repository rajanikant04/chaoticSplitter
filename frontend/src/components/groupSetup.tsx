import { useState, useRef } from 'react';
import { parseGroupAudio } from '../services/api';

interface GroupSetupProps {
  onGroupConfirmed: (groupName: string, members: string[]) => void;
}

export function GroupSetup({ onGroupConfirmed }: GroupSetupProps) {
  const [groupName, setGroupName] = useState('Weekend Hangout');
  const [memberCount, setMemberCount] = useState<number>(3);
  const [memberNames, setMemberNames] = useState<string[]>(['Alice', 'Bob', 'Charlie']);
  const [error, setError] = useState<string>('');

  const [isListening, setIsListening] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [voiceNotice, setVoiceNotice] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleCountChange = (count: number) => {
    const validCount = Math.max(2, Math.min(20, count || 2));
    setMemberCount(validCount);

    setMemberNames((prev) => {
      const updated = [...prev];
      if (updated.length < validCount) {
        for (let i = updated.length; i < validCount; i++) {
          updated.push(`Friend ${i + 1}`);
        }
      } else {
        updated.length = validCount;
      }
      return updated;
    });
  };

  const handleNameChange = (index: number, newName: string) => {
    setMemberNames((prev) => {
      const updated = [...prev];
      updated[index] = newName;
      return updated;
    });
  };

  const handleSendAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    setVoiceNotice('⏳ Transcribing audio with ElevenLabs & extracting with Gemma 2...');
    setError('');

    try {
      const data = await parseGroupAudio(audioBlob);
      if (data) {
        setVoiceNotice(`🎙️ Heard: "${data.transcript}"`);

        // Set group name from Gemma JSON response
        if (data.group_name) {
          setGroupName(data.group_name);
        }

        // Set members from Gemma JSON response
        if (data.members && data.members.length > 0) {
          const count = Math.min(20, Math.max(2, data.members.length));
          setMemberCount(count);
          setMemberNames(data.members.slice(0, count));
        }
      }
    } catch (err: any) {
      setVoiceNotice('');
      setError(err?.response?.data?.detail || err?.message || 'Failed to process group audio.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Pick best supported MIME type across Chrome, Firefox, Safari
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        ''
      ];
      const selectedMime = mimeTypes.find(type => !type || MediaRecorder.isTypeSupported(type)) || '';
      const options = selectedMime ? { mimeType: selectedMime } : {};

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const actualType = selectedMime || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualType });
        
        // Stop all tracks to release the microphone hardware
        stream.getTracks().forEach((track) => track.stop());

        if (audioBlob.size === 0) {
          setError('No audio captured. Please speak into your microphone and try again.');
          return;
        }

        await handleSendAudio(audioBlob);
      };

      // Request data in chunks every 250ms so ondataavailable fires reliably
      mediaRecorder.start(250);
      setIsListening(true);
      setVoiceNotice('🔴 Listening... Say group & friends (e.g. "Goa trip with Alice Bob and Charlie")');
    } catch (err: any) {
      setError('Microphone access denied or audio device not found.');
      setIsListening(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  const toggleMic = () => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanGroupName = groupName.trim() || 'My Group';
    const cleanMembers = memberNames.map((n, i) => n.trim() || `Friend ${i + 1}`);

    // Check for duplicate names
    const lowerNames = cleanMembers.map((n) => n.toLowerCase());
    const hasDuplicates = new Set(lowerNames).size !== lowerNames.length;
    if (hasDuplicates) {
      setError('Each friend must have a unique name.');
      return;
    }

    setError('');
    onGroupConfirmed(cleanGroupName, cleanMembers);
  };

  return (
    <div className="card" style={{ position: 'relative' }}>
      {/* Top Header with Mic Button in Top Right */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '0.4rem',
        }}
      >
        <h2 style={{ margin: 0 }}>👥 Step 0: Group Setup</h2>

        {/* Mic Option at Top Right Corner */}
        <button
          type="button"
          onClick={toggleMic}
          disabled={isTranscribing}
          title={isListening ? 'Stop recording' : 'Speak group details (ElevenLabs Voice)'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0.45em 0.8em',
            fontSize: '0.85em',
            border: isListening ? '1px solid #ef4444' : '1px solid #444',
            backgroundColor: isListening ? 'rgba(239, 68, 68, 0.15)' : '#1f1f1f',
            color: isListening ? '#f87171' : '#fff',
            cursor: isTranscribing ? 'not-allowed' : 'pointer',
            opacity: isTranscribing ? 0.6 : 1,
          }}
        >
          <span style={{ fontSize: '1.1em' }}>
            {isTranscribing ? '⏳' : isListening ? '🛑' : '🎙️'}
          </span>
          <span>
            {isTranscribing ? 'Transcribing...' : isListening ? 'Stop' : 'Mic'}
          </span>
        </button>
      </div>

      <p style={{ marginBottom: '1.2rem' }}>
        Before scanning receipts and assigning expenses, tell us who is splitting this bill.
      </p>

      {/* Voice feedback indicator */}
      {voiceNotice && (
        <div
          style={{
            padding: '0.5rem 0.8rem',
            border: '1px solid #646cff',
            backgroundColor: 'rgba(100, 108, 255, 0.1)',
            color: '#a5b4fc',
            marginBottom: '1rem',
            fontSize: '0.85em',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>🎙️</span>
          <span>{voiceNotice}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '0.6rem 0.8rem',
            border: '1px solid #ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#f87171',
            marginBottom: '1rem',
            fontSize: '0.88em',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        {/* Group Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.85em', color: '#aaa', fontWeight: 500 }}>
            Group / Event Name
          </label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="e.g. Goa Trip, Friday Dinner"
            required
            style={{ width: '100%' }}
          />
        </div>

        {/* Number of Friends */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.85em', color: '#aaa', fontWeight: 500 }}>
            Number of Friends in Group
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleCountChange(memberCount - 1)}
              disabled={memberCount <= 2}
              style={{ padding: '0.5em 1em', border: '1px solid #333' }}
            >
              -
            </button>
            <input
              type="number"
              min={2}
              max={20}
              value={memberCount}
              onChange={(e) => handleCountChange(parseInt(e.target.value, 10))}
              style={{ width: '80px', textAlign: 'center' }}
            />
            <button
              type="button"
              onClick={() => handleCountChange(memberCount + 1)}
              disabled={memberCount >= 20}
              style={{ padding: '0.5em 1em', border: '1px solid #333' }}
            >
              +
            </button>
            <span style={{ fontSize: '0.85em', color: '#666' }}>(Min 2, Max 20)</span>
          </div>
        </div>

        {/* Member Names Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.85em', color: '#aaa', fontWeight: 500 }}>
            Friends' Names
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '8px',
            }}
          >
            {memberNames.map((name, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.8em', color: '#666', width: '20px' }}>
                  #{idx + 1}
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(idx, e.target.value)}
                  placeholder={`Friend ${idx + 1}`}
                  required
                  style={{ width: '100%' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Confirm Button */}
        <button
          type="submit"
          style={{
            marginTop: '0.8rem',
            padding: '0.8em',
            backgroundColor: '#646cff',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.95em',
            border: 'none',
          }}
        >
          Proceed to 4 Steps →
        </button>
      </form>
    </div>
  );
}

export default GroupSetup;
