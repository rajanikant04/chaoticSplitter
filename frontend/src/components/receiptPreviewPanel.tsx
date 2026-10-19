import { useState } from 'react';
import type { ReceiptData } from '../services/api';

interface ReceiptPreviewPanelProps {
  imageUrl: string;
  receiptData: ReceiptData | null;
  onRetake: () => void;
}

export function ReceiptPreviewPanel({ imageUrl, receiptData, onRetake }: ReceiptPreviewPanelProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState<boolean>(false);

  return (
    <div
      style={{
        border: '1px solid #333',
        backgroundColor: '#161616',
        padding: '0.85rem 1rem',
        marginTop: '0.8rem',
        marginBottom: '0.8rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1rem' }}>🧾</span>
          <strong style={{ fontSize: '0.92em', color: '#fff' }}>
            RECEIPT REFERENCE
            {receiptData?.merchant_name && receiptData.merchant_name !== 'Restaurant'
              ? `: ${receiptData.merchant_name}`
              : ''}
          </strong>
          {receiptData?.grand_total !== undefined && (
            <span
              style={{
                fontSize: '0.82em',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                padding: '2px 8px',
                border: '1px solid #10b981',
                fontWeight: 600,
              }}
            >
              {receiptData.currency} {receiptData.grand_total.toFixed(2)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setIsZoomModalOpen(true)}
            style={{
              padding: '3px 10px',
              fontSize: '0.78em',
              border: '1px solid #646cff',
              color: '#646cff',
              backgroundColor: 'rgba(100, 108, 255, 0.08)',
            }}
            title="Open enlarged receipt preview"
          >
            🔍 Zoom Photo
          </button>
          <button
            type="button"
            onClick={onRetake}
            style={{
              padding: '3px 10px',
              fontSize: '0.78em',
              border: '1px solid #444',
              color: '#aaa',
            }}
            title="Retake or re-upload receipt"
          >
            📷 Change
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              padding: '3px 8px',
              fontSize: '0.78em',
              border: '1px solid #333',
              color: '#888',
            }}
          >
            {isExpanded ? '▲ Hide' : '▼ Show'}
          </button>
        </div>
      </div>

      {/* Expandable Image & Mini Details */}
      {isExpanded && (
        <div
          className="mobile-stack"
          style={{
            display: 'flex',
            gap: '14px',
            alignItems: 'center',
            backgroundColor: '#0f0f0f',
            border: '1px solid #242424',
            padding: '8px',
            overflow: 'hidden',
          }}
        >
          {/* Clickable Image thumbnail */}
          <div
            onClick={() => setIsZoomModalOpen(true)}
            style={{
              width: '110px',
              height: '110px',
              minWidth: '110px',
              backgroundColor: '#000',
              border: '1px solid #333',
              cursor: 'zoom-in',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
            title="Click to zoom receipt"
          >
            <img
              src={imageUrl}
              alt="Receipt Thumbnail"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                width: '100%',
                backgroundColor: 'rgba(0,0,0,0.65)',
                color: '#fff',
                fontSize: '0.65em',
                textAlign: 'center',
                padding: '2px 0',
              }}
            >
              Click to Zoom
            </div>
          </div>

          {/* Quick Info & Line Items hint */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '0.82em', color: '#aaa' }}>
              Keep this receipt in sight while speaking your split instructions in Step 2.
            </div>
            {receiptData?.tabpfn_anomaly_alert && (
              <div style={{ fontSize: '0.78em', color: '#fbbf24', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderLeft: '2px solid #f59e0b' }}>
                🛡️ TabPFN: {receiptData.tabpfn_anomaly_alert}
              </div>
            )}
            {receiptData?.items && receiptData.items.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  maxHeight: '75px',
                  overflowY: 'auto',
                  marginTop: '4px',
                }}
              >
                {receiptData.items.map((it) => (
                  <span
                    key={it.item_id}
                    style={{
                      fontSize: '0.75em',
                      backgroundColor: '#1e1e1e',
                      border: '1px solid #333',
                      padding: '2px 6px',
                      color: '#ddd',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    #{it.item_id} {it.name} ({receiptData.currency} {it.total_price.toFixed(2)})
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: '0.8em', color: '#666' }}>Receipt image ready for reference</span>
            )}
          </div>
        </div>
      )}

      {/* Lightbox / Zoom Modal */}
      {isZoomModalOpen && (
        <div
          onClick={() => setIsZoomModalOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.88)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '1.5rem',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '90vh',
              backgroundColor: '#121212',
              border: '1px solid #444',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#fff', fontSize: '0.9em', fontWeight: 600 }}>
                🧾 Full Receipt View
                {receiptData?.merchant_name ? ` • ${receiptData.merchant_name}` : ''}
              </span>
              <button
                type="button"
                onClick={() => setIsZoomModalOpen(false)}
                style={{
                  padding: '2px 8px',
                  fontSize: '0.85em',
                  border: '1px solid #555',
                  color: '#fff',
                  backgroundColor: '#222',
                }}
              >
                ✕ Close
              </button>
            </div>

            <div
              style={{
                overflow: 'auto',
                maxHeight: '80vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <img
                src={imageUrl}
                alt="Full Receipt"
                style={{
                  maxWidth: '100%',
                  maxHeight: '78vh',
                  objectFit: 'contain',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReceiptPreviewPanel;
