interface SettlePayProps {
  groupName: string;
  members: string[];
}

export function SettlePay({ groupName, members }: SettlePayProps) {
  return (
    <div className="card" style={{ flex: 1 }}>
      <h2>4. Settle & Pay</h2>
      <p style={{ marginBottom: '1.5rem' }}>
        Zero-leakage proportional math, UPI payment links, and WhatsApp share card for <strong>{groupName}</strong>.
      </p>

      <div
        style={{
          padding: '2.5rem 1rem',
          border: '1px dashed #333',
          textAlign: 'center',
          backgroundColor: '#161616',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💳</div>
        <p style={{ margin: 0, color: '#aaa' }}>
          Final settlement breakdown for: {members.join(', ')}
        </p>
        <p style={{ fontSize: '0.82em', color: '#666', marginTop: '6px' }}>
          Exact penny-rounding preservation with Python Decimal engine
        </p>
      </div>
    </div>
  );
}

export default SettlePay;
