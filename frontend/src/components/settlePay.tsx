import { useState, useEffect, useCallback } from 'react';
import {
  settleAndGeneratePayments,
  type ReceiptData,
  type VoiceSplitPlan,
  type SettlementSummary,
  type ParticipantShare,
} from '../services/api';

export interface SettlePayProps {
  groupName: string;
  members: string[];
  receiptData?: ReceiptData | null;
  splitPlan?: VoiceSplitPlan | null;
  onBackToVerify?: () => void;
}

export function SettlePay({
  groupName,
  members,
  receiptData,
  splitPlan,
  onBackToVerify,
}: SettlePayProps) {
  // Payer Question & UPI State
  const [payerName, setPayerName] = useState<string>(members[0] || 'Me');
  const [payerUpi, setPayerUpi] = useState<string>('');
  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [settlement, setSettlement] = useState<SettlementSummary | null>(null);
  const [error, setError] = useState<string>('');

  // UI feedback states
  const [copiedPerson, setCopiedPerson] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [zoomedQr, setZoomedQr] = useState<{ person: string; qrUrl: string; amount: number } | null>(null);

  // Sync default payer if members change
  useEffect(() => {
    if (members.length > 0 && !members.includes(payerName)) {
      setPayerName(members[0]);
    }
  }, [members, payerName]);

  // Request backend /api/settle to calculate shares and generate QR codes
  const handleCalculateSettlement = useCallback(async (currentPayer = payerName, currentUpi = payerUpi) => {
    if (!receiptData || !splitPlan) return;

    setIsSettling(true);
    setError('');

    try {
      const result = await settleAndGeneratePayments({
        receipt: receiptData,
        plan: splitPlan,
        payer_name: currentPayer,
        payer_upi_vpa: currentUpi.trim() || undefined,
      });
      setSettlement(result);
    } catch (err: any) {
      console.error('Settlement calculation failed:', err);
      setError(err?.response?.data?.detail || 'Failed to calculate settlement.');
    } finally {
      setIsSettling(false);
    }
  }, [payerName, payerUpi, receiptData, splitPlan]);

  // Auto-run on mount or when payer details change
  useEffect(() => {
    handleCalculateSettlement();
  }, [handleCalculateSettlement]);

  // Copy individual payment link to clipboard
  const handleCopyLink = async (person: string, link?: string | null) => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedPerson(person);
      setTimeout(() => setCopiedPerson(null), 2000);
    } catch {
      // fallback
    }
  };

  // Copy whole group summary for WhatsApp
  const handleCopyWhatsAppSummary = async () => {
    if (!settlement) return;

    let text = `🧾 *${settlement.merchant_name} Bill Split - ${groupName}*\n`;
    text += `💰 Grand Total: ₹${settlement.grand_total.toFixed(2)}\n`;
    text += `👑 Paid by: *${payerName}*`;
    if (payerUpi) {
      text += ` (UPI: ${payerUpi})`;
    }
    text += `\n\n*Individual Amounts Owed to ${payerName}:*\n`;

    settlement.participants.forEach((p) => {
      if (p.person === payerName) {
        text += `• *${p.person}* (Payer): ₹${p.final_total.toFixed(2)} (Own share)\n`;
      } else {
        text += `• *${p.person}*: *₹${p.final_total.toFixed(2)}*`;
        if (p.upi_link) {
          text += ` → Pay: ${p.upi_link}`;
        }
        text += `\n`;
      }
    });

    text += `\n_Generated with zero-leakage precision via ChaoticSplitter_ ⚡`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch {
      // fallback
    }
  };

  // If no receipt or plan loaded, show friendly empty guard
  if (!receiptData || !splitPlan) {
    return (
      <div className="card" style={{ flex: 1, padding: '2.5rem 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🧾</div>
        <h3 style={{ margin: 0, color: '#f59e0b' }}>No verified bill data available</h3>
        <p style={{ color: '#888', marginTop: '6px' }}>
          Please go back to Step 1 to snap a receipt, or Step 3 to verify items.
        </p>
        {onBackToVerify && (
          <button
            type="button"
            onClick={onBackToVerify}
            style={{
              marginTop: '1.2rem',
              padding: '0.7em 1.4em',
              backgroundColor: '#646cff',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
            }}
          >
            ← Back to Verify Items
          </button>
        )}
      </div>
    );
  }

  // Friends who owe money (excluding payer)
  const otherParticipants = settlement?.participants.filter((p) => p.person !== payerName) || [];
  const payerShare = settlement?.participants.find((p) => p.person === payerName);

  return (
    <div className="card" style={{ flex: 1, textAlign: 'left' }}>
      {/* Step Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ margin: 0 }}>4. Settle & Pay</h2>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: '0.9em' }}>
            Zero-leakage proportional settlement & dynamic UPI QR codes for <strong>{groupName}</strong>.
          </p>
        </div>
        {settlement && (
          <button
            type="button"
            onClick={handleCopyWhatsAppSummary}
            style={{
              padding: '6px 14px',
              fontSize: '0.85em',
              border: '1px solid #10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              fontWeight: 600,
            }}
          >
            {copiedSummary ? '✓ Copied for WhatsApp!' : '📋 Copy WhatsApp Summary'}
          </button>
        )}
      </div>

      {/* Question 1: Who paid the bill? */}
      <div
        style={{
          marginTop: '1.2rem',
          backgroundColor: '#1b1b1b',
          border: '1px solid #333',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div>
          <label style={{ fontSize: '0.88em', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>👑</span> Who paid for all the items?
          </label>
          <p style={{ margin: '2px 0 8px', fontSize: '0.78em', color: '#888' }}>
            Select the person who covered the bill. Everyone else will receive a direct QR code to pay them.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {members.map((m) => {
              const isSelected = m === payerName;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setPayerName(m);
                    handleCalculateSettlement(m, payerUpi);
                  }}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.88em',
                    border: isSelected ? '1px solid #10b981' : '1px solid #444',
                    backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.2)' : '#141414',
                    color: isSelected ? '#10b981' : '#ccc',
                    fontWeight: isSelected ? 700 : 400,
                  }}
                >
                  {isSelected ? '👑 ' : ''}
                  {m}
                  {isSelected ? ' (Payer)' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question 2: Payer's UPI ID */}
        <div style={{ borderTop: '1px solid #282828', paddingTop: '10px' }}>
          <label style={{ fontSize: '0.88em', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>💳</span> {payerName}'s UPI ID (for QR code payments):
          </label>
          <p style={{ margin: '2px 0 6px', fontSize: '0.78em', color: '#888' }}>
            Enter your VPA (e.g. <code>username@okaxis</code> or <code>mobile@paytm</code>) to generate direct scan-and-pay QR codes.
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={payerUpi}
              onChange={(e) => setPayerUpi(e.target.value)}
              placeholder="e.g. rahul@oksbi or 9876543210@paytm"
              style={{
                flex: 1,
                minWidth: '220px',
                padding: '8px 12px',
                backgroundColor: '#141414',
                border: '1px solid #444',
                color: '#fff',
                fontSize: '0.9em',
              }}
            />
            <button
              type="button"
              onClick={() => handleCalculateSettlement(payerName, payerUpi)}
              disabled={isSettling}
              style={{
                padding: '8px 16px',
                backgroundColor: '#646cff',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.88em',
              }}
            >
              {isSettling ? 'Generating...' : '⚡ Generate QR Codes'}
            </button>
          </div>

          {/* Quick handle helpers */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
            <span style={{ fontSize: '0.75em', color: '#666', alignSelf: 'center' }}>Quick suffix:</span>
            {['@okaxis', '@oksbi', '@okhdfcbank', '@paytm', '@ybl'].map((suf) => (
              <button
                key={suf}
                type="button"
                onClick={() => {
                  const base = payerUpi.includes('@') ? payerUpi.split('@')[0] : payerUpi || payerName.toLowerCase();
                  const newUpi = `${base}${suf}`;
                  setPayerUpi(newUpi);
                  handleCalculateSettlement(payerName, newUpi);
                }}
                style={{
                  padding: '2px 7px',
                  fontSize: '0.74em',
                  border: '1px solid #333',
                  backgroundColor: '#161616',
                  color: '#aaa',
                }}
              >
                +{suf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bill & Settlement Summary Banner */}
      {settlement && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#161616',
            border: '1px solid #333',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span style={{ fontSize: '0.82em', color: '#888' }}>RESTAURANT / MERCHANT: </span>
              <strong style={{ color: '#fff' }}>{settlement.merchant_name}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.9em', color: '#aaa' }}>
                Total: <strong style={{ color: '#10b981', fontSize: '1.1em' }}>₹{settlement.grand_total.toFixed(2)}</strong>
              </span>
              <span
                style={{
                  fontSize: '0.78em',
                  padding: '2px 8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid #10b981',
                  fontWeight: 600,
                }}
              >
                ✓ ZERO-LEAKAGE VERIFIED
              </span>
            </div>
          </div>

          {/* Payer Highlight Note */}
          <div
            style={{
              padding: '0.75rem 0.9rem',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              borderLeft: '3px solid #10b981',
              fontSize: '0.88em',
              color: '#ddd',
            }}
          >
            👑 <strong>{payerName}</strong> paid the bill of <strong>₹{settlement.grand_total.toFixed(2)}</strong>.
            {payerShare && (
              <span style={{ marginLeft: '6px', color: '#aaa' }}>
                ({payerName}'s personal consumption share is <strong>₹{payerShare.final_total.toFixed(2)}</strong>).
              </span>
            )}
            <br />
            <span style={{ fontSize: '0.82em', color: '#999' }}>
              The remaining {otherParticipants.length} friends each have a personalized QR code below to pay <strong>{payerName}</strong> directly.
            </span>
          </div>

          {error && (
            <p style={{ margin: '6px 0 0', color: '#ef4444', fontSize: '0.82em' }}>
              ⚠️ {error}
            </p>
          )}
        </div>
      )}

      {/* Individual Participant QR & Settlement Cards */}
      <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '1.05em', color: '#fff' }}>
          Direct Payments to {payerName}:
        </h3>

        {otherParticipants.map((p: ParticipantShare) => (
          <div
            key={p.person}
            style={{
              backgroundColor: '#1b1b1b',
              border: '1px solid #333',
              padding: '1.2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Card Header: Name & Amount Owed */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                borderBottom: '1px solid #282828',
                paddingBottom: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '32px',
                    height: '32px',
                    lineHeight: '32px',
                    textAlign: 'center',
                    backgroundColor: '#646cff',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.9em',
                  }}
                >
                  {p.person.charAt(0).toUpperCase()}
                </span>
                <div>
                  <strong style={{ fontSize: '1.05em', color: '#fff' }}>{p.person}</strong>
                  <div style={{ fontSize: '0.78em', color: '#888' }}>
                    Owes directly to <strong>{payerName}</strong>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.78em', color: '#aaa' }}>AMOUNT TO PAY:</div>
                <div style={{ fontSize: '1.4em', color: '#10b981', fontWeight: 800 }}>
                  ₹{p.final_total.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Consumption & Tax Breakdown */}
            <div
              style={{
                backgroundColor: '#141414',
                padding: '0.65rem 0.85rem',
                border: '1px solid #242424',
                fontSize: '0.82em',
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div>
                <span style={{ color: '#888' }}>Food Subtotal: </span>
                <strong style={{ color: '#fff' }}>₹{p.subtotal.toFixed(2)}</strong>
              </div>
              {p.tax_share > 0 && (
                <div>
                  <span style={{ color: '#888' }}>Taxes: </span>
                  <strong style={{ color: '#ddd' }}>+₹{p.tax_share.toFixed(2)}</strong>
                </div>
              )}
              {p.tip_share > 0 && (
                <div>
                  <span style={{ color: '#888' }}>Tip/Service: </span>
                  <strong style={{ color: '#ddd' }}>+₹{p.tip_share.toFixed(2)}</strong>
                </div>
              )}
              {p.discount_share > 0 && (
                <div>
                  <span style={{ color: '#888' }}>Discount: </span>
                  <strong style={{ color: '#10b981' }}>-₹{p.discount_share.toFixed(2)}</strong>
                </div>
              )}
            </div>

            {/* Items Consumed list */}
            {p.items_consumed && p.items_consumed.length > 0 && (
              <div style={{ fontSize: '0.8em', color: '#aaa' }}>
                <span style={{ color: '#666' }}>Dishes: </span>
                {p.items_consumed.join(' • ')}
              </div>
            )}

            {/* QR Code & Pay Action Block */}
            <div
              style={{
                backgroundColor: '#151515',
                border: '1px solid #2c2c2c',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '14px',
              }}
            >
              {/* QR Code Presentation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {p.qr_code_data_url ? (
                  <div
                    onClick={() => setZoomedQr({ person: p.person, qrUrl: p.qr_code_data_url!, amount: p.final_total })}
                    style={{
                      backgroundColor: '#ffffff',
                      padding: '6px',
                      cursor: 'pointer',
                      border: '1px solid #444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Click to zoom QR Code"
                  >
                    <img
                      src={p.qr_code_data_url}
                      alt={`UPI QR for ${p.person}`}
                      style={{ width: '90px', height: '90px', display: 'block' }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: '90px',
                      height: '90px',
                      border: '1px dashed #444',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7em',
                      color: '#666',
                      textAlign: 'center',
                      padding: '4px',
                    }}
                  >
                    <span>📱</span>
                    <span>Enter UPI to view QR</span>
                  </div>
                )}

                <div>
                  <strong style={{ fontSize: '0.88em', color: '#fff', display: 'block' }}>
                    Scan to Pay {payerName}
                  </strong>
                  <span style={{ fontSize: '0.78em', color: '#888', display: 'block', marginTop: '2px' }}>
                    {payerUpi ? `Paying: ${payerUpi}` : 'Dynamic 1-Tap UPI QR'}
                  </span>
                  <span style={{ fontSize: '0.75em', color: '#10b981', display: 'block', marginTop: '4px' }}>
                    GPay • PhonePe • Paytm • BHIM
                  </span>
                  {p.qr_code_data_url && (
                    <button
                      type="button"
                      onClick={() => setZoomedQr({ person: p.person, qrUrl: p.qr_code_data_url!, amount: p.final_total })}
                      style={{
                        padding: '2px 6px',
                        fontSize: '0.72em',
                        border: '1px solid #444',
                        backgroundColor: '#1b1b1b',
                        color: '#bbb',
                        marginTop: '6px',
                      }}
                    >
                      🔍 Zoom QR
                    </button>
                  )}
                </div>
              </div>

              {/* Direct Link and Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '160px' }}>
                {p.upi_link ? (
                  <a
                    href={p.upi_link}
                    style={{
                      display: 'block',
                      padding: '8px 14px',
                      backgroundColor: '#10b981',
                      color: '#000',
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: '0.86em',
                      textDecoration: 'none',
                    }}
                  >
                    ⚡ 1-Tap Pay ₹{p.final_total.toFixed(2)}
                  </a>
                ) : null}

                {p.upi_link && (
                  <button
                    type="button"
                    onClick={() => handleCopyLink(p.person, p.upi_link)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.78em',
                      border: '1px solid #444',
                      backgroundColor: '#202020',
                      color: '#ccc',
                    }}
                  >
                    {copiedPerson === p.person ? '✓ Link Copied!' : 'Copy Payment Link'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Footer */}
      <div
        style={{
          marginTop: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          borderTop: '1px solid #333',
          paddingTop: '1.2rem',
        }}
      >
        {onBackToVerify && (
          <button
            type="button"
            onClick={onBackToVerify}
            style={{
              padding: '0.7em 1.2em',
              fontSize: '0.9em',
              border: '1px solid #444',
              backgroundColor: '#1b1b1b',
              color: '#ccc',
            }}
          >
            ← Back to Verify Items
          </button>
        )}

        <button
          type="button"
          onClick={handleCopyWhatsAppSummary}
          style={{
            padding: '0.8em 1.6em',
            fontSize: '0.95em',
            fontWeight: 700,
            border: 'none',
            backgroundColor: '#10b981',
            color: '#000',
          }}
        >
          {copiedSummary ? '✓ Copied Summary!' : 'Share Breakdown on WhatsApp →'}
        </button>
      </div>

      {/* Zoomed QR Lightbox Modal */}
      {zoomedQr && (
        <div
          onClick={() => setZoomedQr(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #444',
              padding: '1.8rem',
              textAlign: 'center',
              maxWidth: '380px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <h3 style={{ margin: 0, color: '#fff' }}>
              Pay {payerName}
            </h3>
            <p style={{ margin: 0, color: '#aaa', fontSize: '0.9em' }}>
              Amount: <strong style={{ color: '#10b981', fontSize: '1.3em' }}>₹{zoomedQr.amount.toFixed(2)}</strong>
            </p>
            <p style={{ margin: 0, color: '#888', fontSize: '0.8em' }}>
              For {zoomedQr.person}'s share
            </p>

            <div style={{ backgroundColor: '#fff', padding: '12px', border: '1px solid #555' }}>
              <img
                src={zoomedQr.qrUrl}
                alt="Zoomed QR"
                style={{ width: '220px', height: '220px', display: 'block' }}
              />
            </div>

            <p style={{ margin: 0, color: '#bbb', fontSize: '0.82em' }}>
              {payerUpi ? `UPI: ${payerUpi}` : 'Scan with any UPI app'}
            </p>

            <button
              type="button"
              onClick={() => setZoomedQr(null)}
              style={{
                marginTop: '8px',
                padding: '6px 16px',
                border: '1px solid #555',
                backgroundColor: '#252525',
                color: '#fff',
                fontSize: '0.85em',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettlePay;
