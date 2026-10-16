interface ExplainSplitProps {
  groupName: string;
  members: string[];
}

export function ExplainSplit({ groupName, members }: ExplainSplitProps) {
  return (
    <div className="card" style={{ flex: 1 }}>
      <h2>2. Explain Split</h2>
      <p style={{ marginBottom: '1.5rem' }}>
        Record a voice memo (ElevenLabs Scribe) or type splitting rules for <strong>{groupName}</strong>.
      </p>

      <div
        style={{
          padding: '2.5rem 1rem',
          border: '1px dashed #333',
          textAlign: 'center',
          backgroundColor: '#161616',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎙️</div>
        <p style={{ margin: 0, color: '#aaa' }}>
          Explain who ate or drank what (e.g., &ldquo;{members[0] || 'Friend 1'} didn&apos;t have drinks&rdquo;)
        </p>
        <p style={{ fontSize: '0.82em', color: '#666', marginTop: '6px' }}>
          Voice input powered by ElevenLabs Scribe STT
        </p>
      </div>
    </div>
  );
}

export default ExplainSplit;
