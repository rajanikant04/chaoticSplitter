import type { ReceiptData, VoiceSplitPlan } from "../services/api";

interface VerifyItemsProps {
  groupName: string;
  members: string[];
  receiptData: ReceiptData;
  splitPlan: VoiceSplitPlan;
  onPlanConfirmed: (updatedReceipt: ReceiptData, updatedPlan: VoiceSplitPlan) => void;
  onBackToExplain: () => void;
}


export function VerifyItems({ groupName, members }: VerifyItemsProps) {
  return (
    <div className="card" style={{ flex: 1 }}>
      <h2>3. Verify Items</h2>
      <p style={{ marginBottom: '1.5rem' }}>
        Interactive receipt items table with tappable participant chips for <strong>{groupName}</strong>.
      </p>

      <div
        style={{
          padding: '2.5rem 1rem',
          border: '1px dashed #333',
          textAlign: 'center',
          backgroundColor: '#161616',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🧾</div>
        <p style={{ margin: 0, color: '#aaa' }}>
          Assign extracted line items to: {members.join(', ')}
        </p>
        <p style={{ fontSize: '0.82em', color: '#666', marginTop: '6px' }}>
          Deterministic Python math engine guarantees 100% item coverage
        </p>
      </div>
    </div>
  );
}

export default VerifyItems;
