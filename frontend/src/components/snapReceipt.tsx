interface SnapReceiptProps {
  groupName: string;
  members: string[];
}

export function SnapReceipt({ groupName, members }: SnapReceiptProps) {
  return (
    <div className="card" style={{ flex: 1 }}>
      <h2>1. Snap Receipt</h2>
      <p style={{ marginBottom: '1.5rem' }}>
        Capture a receipt photo via device camera or upload a receipt image for <strong>{groupName}</strong>.
      </p>

      <div
        style={{
          padding: '2.5rem 1rem',
          border: '1px dashed #333',
          textAlign: 'center',
          backgroundColor: '#161616',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📷</div>
        <p style={{ margin: 0, color: '#aaa' }}>
          Drop receipt image here or click to browse
        </p>
        <p style={{ fontSize: '0.82em', color: '#666', marginTop: '6px' }}>
          Participants ready: {members.join(', ')}
        </p>
      </div>
    </div>
  );
}

export default SnapReceipt;
