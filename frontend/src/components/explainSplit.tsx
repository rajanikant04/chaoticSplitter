import { useState, useRef, useEffect } from 'react';
import {
  transcribeAudio,
  generateSplitPlan,
  type ReceiptData,
  type VoiceSplitPlan,
} from '../services/api';

interface ExplainSplitProps {
  groupName: string;
  members: string[];
  receiptData: ReceiptData;
  onSplitPlanGenerated: (plan: VoiceSplitPlan) => void;
}

export function ExplainSplit({
  groupName,
  members,
  receiptData,
  onSplitPlanGenerated,
}: ExplainSplitProps) {
  const [instructions, setInstructions] = useState<string>('');

  // Mic recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [previewPlan, setPreviewPlan] = useState<VoiceSplitPlan | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    return () => {
      stopRecordingCleanup();
    };
  }, []);

  const stopRecordingCleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const startVoiceRecording = async () => {
    setError('');
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleSendAudioToScribe(audioBlob);
      };

      mediaRecorder.start(250);
      setIsRecording(true);

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setError('Microphone permission denied or no audio device found.');
      setIsRecording(false);
    }
  };

  const stopVoiceRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleSendAudioToScribe = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    setError('');
    try {
      const res = await transcribeAudio(audioBlob);
      const text = res.transcript.trim();
      if (text) {
        setInstructions((prev) => (prev ? `${prev} ${text}` : text));
      } else {
        setError('No speech detected in recording. You can also type your instructions directly below.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to transcribe voice memo.';
      setError(`ElevenLabs Scribe: ${msg}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const insertTextAtCursor = (textToInsert: string) => {
    if (!textareaRef.current) {
      setInstructions((prev) => (prev ? `${prev} ${textToInsert}` : textToInsert));
      return;
    }

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = instructions;
    const updated = current.substring(0, start) + textToInsert + current.substring(end);
    setInstructions(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 0);
  };

  const handleGeneratePlan = async () => {
    const trimmed = instructions.trim();
    if (!trimmed) {
      setError('Please speak or type your splitting instructions first (or click Quick Split All).');
      return;
    }

    setIsGeneratingPlan(true);
    setError('');

    try {
      const plan = await generateSplitPlan(receiptData, trimmed, members, 'split_all');
      setPreviewPlan(plan);
      onSplitPlanGenerated(plan);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to generate split plan with Gemma 4.';
      setError(msg);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleQuickEqualSplit = () => {
    const quickText = `Split all dishes and drinks equally among ${members.join(', ')}.`;
    setInstructions(quickText);
  };

  return (
    <div className="card" style={{ flex: 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '8px' }}>
        <h2 style={{ margin: 0 }}>🗣️ Step 2: Explain Split</h2>
        <span style={{ fontSize: '0.85em', color: '#646cff' }}>
          Group: <strong>{groupName}</strong> ({members.length} friends)
        </span>
      </div>

      <p style={{ marginBottom: '1.2rem', color: '#888' }}>
        Record a voice note or type how the meal should be divided. Gemma 4 will map each dish to the right friends.
      </p>

      {error && (
        <div
          style={{
            padding: '0.65rem 0.85rem',
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

      {/* Voice Recording Box */}
      <div
        style={{
          border: '1px solid #333',
          backgroundColor: '#161616',
          padding: '1.2rem',
          marginBottom: '1.2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <strong style={{ fontSize: '0.92em', color: '#fff' }}>
            🎙️ Voice Memo (ElevenLabs Scribe STT)
          </strong>
          {isRecording && (
            <span style={{ color: '#ef4444', fontSize: '0.85em', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#ef4444',
                  display: 'inline-block',
                }}
              />
              Recording: {recordingSeconds}s
            </span>
          )}
        </div>

        <div className="responsive-btn-row">
          {!isRecording ? (
            <button
              type="button"
              onClick={startVoiceRecording}
              disabled={isTranscribing || isGeneratingPlan}
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '0.8em 1.2em',
                backgroundColor: '#ef4444',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.92em',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              🔴 Start Voice Note
            </button>
          ) : (
            <button
              type="button"
              onClick={stopVoiceRecording}
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '0.8em 1.2em',
                backgroundColor: '#10b981',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.92em',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              ⏹️ Stop & Transcribe Memo ({recordingSeconds}s)
            </button>
          )}

          <button
            type="button"
            onClick={handleQuickEqualSplit}
            disabled={isRecording || isTranscribing}
            style={{
              padding: '0.8em 1.2em',
              border: '1px solid #444',
              color: '#ddd',
              fontSize: '0.88em',
            }}
          >
            ⚖️ Quick Split Equal
          </button>
        </div>

        {isTranscribing && (
          <div style={{ color: '#646cff', fontSize: '0.85em', textAlign: 'center' }}>
            ⏳ Transcribing your voice memo via ElevenLabs Scribe...
          </div>
        )}
      </div>

      {/* Quick Insertion Chips for Friends and Dishes */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.8em', color: '#888', marginBottom: '6px' }}>
          QUICK CHIPS (Click to insert into instructions):
        </div>

        {/* Member chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.78em', color: '#646cff', alignSelf: 'center', marginRight: '4px' }}>
            Friends:
          </span>
          {members.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => insertTextAtCursor(` ${m} `)}
              style={{
                padding: '3px 8px',
                fontSize: '0.78em',
                border: '1px solid #333',
                backgroundColor: '#1b1b1b',
                color: '#fff',
              }}
              title={`Click to insert ${m}`}
            >
              + {m}
            </button>
          ))}
        </div>

        {/* Dish chips from receipt */}
        {receiptData?.items && receiptData.items.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '0.78em', color: '#10b981', alignSelf: 'center', marginRight: '4px' }}>
              Dishes:
            </span>
            {receiptData.items.map((it) => (
              <button
                key={it.item_id}
                type="button"
                onClick={() => insertTextAtCursor(` ${it.name} `)}
                style={{
                  padding: '3px 8px',
                  fontSize: '0.78em',
                  border: '1px solid #2a2a2a',
                  backgroundColor: '#141414',
                  color: '#bbb',
                }}
                title={`Click to insert ${it.name}`}
              >
                + #{it.item_id} {it.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Editable Instructions Input Box */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1.2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85em', color: '#aaa', fontWeight: 600 }}>
            Splitting Instructions (Voice Transcript or Manual Rules):
          </label>
          {instructions && (
            <button
              type="button"
              onClick={() => setInstructions('')}
              style={{
                padding: '2px 8px',
                fontSize: '0.75em',
                border: '1px solid #444',
                color: '#f87171',
                backgroundColor: 'transparent',
              }}
            >
              Clear
            </button>
          )}
        </div>
        <textarea
          ref={textareaRef}
          rows={4}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="e.g. Alice and Bob shared the butter naan and paneer tikka, Charlie had the mutton biryani. Everyone shared the soft drinks."
          style={{
            width: '100%',
            resize: 'vertical',
            lineHeight: 1.5,
            fontSize: '0.95em',
          }}
        />
      </div>

      {/* Submit Action */}
      <button
        type="button"
        onClick={handleGeneratePlan}
        disabled={isGeneratingPlan || isRecording}
        style={{
          width: '100%',
          padding: '0.9em',
          backgroundColor: '#646cff',
          color: '#fff',
          fontWeight: 700,
          fontSize: '1em',
          border: 'none',
          cursor: isGeneratingPlan ? 'not-allowed' : 'pointer',
          opacity: isGeneratingPlan ? 0.7 : 1,
        }}
      >
        {isGeneratingPlan ? '⏳ Gemma 4 is Mapping Items to Friends...' : '⚡ Generate AI Split Plan'}
      </button>

      {/* Preview if already generated */}
      {previewPlan && (
        <div style={{ marginTop: '1.2rem', padding: '0.8rem', border: '1px solid #10b981', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
          <strong style={{ color: '#10b981', fontSize: '0.9em' }}>✓ AI Split Plan Ready:</strong>
          <p style={{ margin: '4px 0 0', fontSize: '0.85em', color: '#ccc' }}>
            {previewPlan.reasoning_summary}
          </p>
        </div>
      )}
    </div>
  );
}

export default ExplainSplit;
