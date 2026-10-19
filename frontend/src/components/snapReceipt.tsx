import { useState, useRef, useEffect, type ChangeEvent, type DragEvent } from 'react';
import { uploadReceiptImage, type ReceiptData } from '../services/api';

interface SnapReceiptProps {
  groupName: string;
  members: string[];
  initialImageUrl?: string | null;
  onImageChange?: (url: string | null) => void;
  onReceiptProcessed?: (data: ReceiptData, imageUrl: string) => void;
}

export function SnapReceipt({ groupName, members, initialImageUrl, onImageChange, onReceiptProcessed }: SnapReceiptProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialImageUrl || null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [receiptResult, setReceiptResult] = useState<ReceiptData | null>(null);

  // Sync initialImageUrl if updated from parent
  useEffect(() => {
    if (initialImageUrl && !previewUrl) {
      setPreviewUrl(initialImageUrl);
    }
  }, [initialImageUrl]);

  // Live Camera State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    setError('');
    handleClear();
    try {
      // Request environment (back) camera if available, fallback to user (webcam)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });

      streamRef.current = stream;
      setIsCameraActive(true);

      // Give React a tick to mount video element
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 50);
    } catch (err: any) {
      setError('Camera access denied or no camera device found.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    stopCameraStream();
    setIsCameraActive(false);
  };

  const capturePhotoFromStream = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;

      const file = new File([blob], `receipt_${Date.now()}.jpg`, { type: 'image/jpeg' });
      stopCamera();
      handleFileSelect(file);
    }, 'image/jpeg', 0.95);
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (.jpg, .png, .webp).');
      return;
    }
    setError('');
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setReceiptResult(null);
    if (onImageChange) {
      onImageChange(objectUrl);
    }
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleClear = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setReceiptResult(null);
    setError('');
    stopCameraStream();
    setIsCameraActive(false);
    if (onImageChange) onImageChange(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUploadAndExtract = async () => {
    if (!selectedFile) {
      setError('Please select or capture a new receipt photo first.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const data = await uploadReceiptImage(selectedFile);
      setReceiptResult(data);
      if (data.items.length === 0) {
        setError('No items could be identified on this receipt. Please retake a sharper, flatter photo.');
        return;
      }
      if (onReceiptProcessed && previewUrl) {
        onReceiptProcessed(data, previewUrl);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to extract receipt data.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card" style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
        <h2 style={{ margin: 0 }}>🧾 Step 1: Snap Receipt</h2>
        <span style={{ fontSize: '0.85em', color: '#646cff' }}>
          Group: <strong>{groupName}</strong> ({members.length} friends)
        </span>
      </div>

      <p style={{ marginBottom: '1.2rem', color: '#888' }}>
        Upload or take a photo of the restaurant receipt. Our parser will extract items, quantities, taxes, and prices.
      </p>

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

      {/* Hidden File Picker Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileInputChange}
        style={{ display: 'none' }}
      />

      {/* VIEW 1: LIVE CAMERA VIEW */}
      {isCameraActive ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            border: '1px solid #646cff',
            backgroundColor: '#0a0a0a',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9em', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', display: 'inline-block' }} />
              Live Camera Active (Align receipt inside frame)
            </span>
            <button
              type="button"
              onClick={stopCamera}
              style={{ padding: '3px 10px', fontSize: '0.8em', border: '1px solid #555', color: '#aaa' }}
            >
              ✕ Cancel
            </button>
          </div>

          <div
            style={{
              position: 'relative',
              width: '100%',
              maxHeight: '420px',
              backgroundColor: '#000',
              overflow: 'hidden',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              style={{
                width: '100%',
                maxHeight: '420px',
                objectFit: 'contain',
              }}
            />
          </div>

          <div className="responsive-btn-row">
            <button
              type="button"
              onClick={capturePhotoFromStream}
              style={{
                flex: 1,
                padding: '0.85em',
                backgroundColor: '#10b981',
                color: '#fff',
                fontWeight: 700,
                fontSize: '1em',
                border: 'none',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              📸 Capture Receipt
            </button>
            <button
              type="button"
              onClick={stopCamera}
              style={{ padding: '0.85em 1.2em', border: '1px solid #444', color: '#ccc' }}
            >
              Back
            </button>
          </div>
        </div>
      ) : !previewUrl ? (
        /* VIEW 2: DROP ZONE / START CAMERA */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            padding: '2.5rem 1.5rem',
            border: isDragging ? '2px dashed #646cff' : '1px dashed #333',
            backgroundColor: isDragging ? 'rgba(100, 108, 255, 0.05)' : '#161616',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'border-color 0.2s, background-color 0.2s',
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🧾</div>
          <p style={{ margin: 0, color: '#fff', fontWeight: 600, fontSize: '1.05em' }}>
            Click to upload or drag & drop receipt photo
          </p>
          <p style={{ fontSize: '0.85em', color: '#777', marginTop: '6px' }}>
            Supports PNG, JPG, WEBP • Max 15MB
          </p>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              marginTop: '1.2rem',
              flexWrap: 'wrap',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.55em 1.2em',
                fontSize: '0.9em',
                border: '1px solid #444',
              }}
            >
              📁 Browse Files
            </button>
            <button
              type="button"
              onClick={startCamera}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.55em 1.2em',
                fontSize: '0.9em',
                border: '1px solid #10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                fontWeight: 600,
              }}
            >
              📷 Open Camera
            </button>
          </div>
        </div>
      ) : (
        /* VIEW 3: IMAGE PREVIEW CARD */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            border: '1px solid #333',
            backgroundColor: '#161616',
            padding: '1rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '8px',
              borderBottom: '1px solid #282828',
            }}
          >
            <span style={{ fontSize: '0.9em', color: '#aaa' }}>
              📄 {selectedFile?.name} ({(selectedFile?.size ? (selectedFile.size / 1024).toFixed(1) : '0')} KB)
            </span>
            <button
              type="button"
              onClick={handleClear}
              style={{
                padding: '3px 10px',
                fontSize: '0.8em',
                border: '1px solid #555',
                color: '#f87171',
                backgroundColor: 'transparent',
              }}
            >
              ✕ Remove
            </button>
          </div>

          <div
            style={{
              maxHeight: '360px',
              overflow: 'hidden',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: '#0d0d0d',
              border: '1px solid #222',
            }}
          >
            <img
              src={previewUrl}
              alt="Receipt Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '360px',
                objectFit: 'contain',
              }}
            />
          </div>

          <div className="responsive-btn-row" style={{ marginTop: '8px' }}>
            <button
              type="button"
              onClick={handleUploadAndExtract}
              disabled={isLoading}
              style={{
                flex: 2,
                minWidth: '180px',
                padding: '0.8em',
                backgroundColor: '#646cff',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.95em',
                border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? '⏳ Extracting Receipt Items...' : '⚡ Parse Receipt with AI'}
            </button>
            <button
              type="button"
              onClick={startCamera}
              disabled={isLoading}
              style={{
                padding: '0.8em 1.2em',
                border: '1px solid #10b981',
                color: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.05)',
              }}
            >
              📷 Retake with Camera
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              style={{
                padding: '0.8em 1.2em',
                border: '1px solid #444',
                color: '#ccc',
              }}
            >
              Browse
            </button>
          </div>
        </div>
      )}

      {/* Extracted Receipt Items Preview Table */}
      {receiptResult && (
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid #2f2f2f', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1em', color: '#10b981' }}>
              ✓ Receipt Parsed: {receiptResult.merchant_name}
            </h3>
            <span style={{ fontSize: '0.9em', color: '#aaa' }}>
              Grand Total: <strong style={{ color: '#fff' }}>{receiptResult.currency} {receiptResult.grand_total.toFixed(2)}</strong>
            </span>
          </div>

          {/* Prior Labs TabPFN Anomaly Alert */}
          {receiptResult.tabpfn_anomaly_alert && (
            <div
              style={{
                marginTop: '0.8rem',
                padding: '0.65rem 0.85rem',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                borderLeft: '3px solid #f59e0b',
                color: '#fbbf24',
                fontSize: '0.85em',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '1.1em' }}>🛡️</span>
              <div>
                <strong>Prior Labs TabPFN Anomaly Alert:</strong>
                <div style={{ marginTop: '2px', color: '#fcd34d' }}>
                  {receiptResult.tabpfn_anomaly_alert}
                </div>
              </div>
            </div>
          )}

          {/* Prior Labs TabPFN Suggested Tip */}
          {receiptResult.suggested_tip_percentage && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.4rem 0.75rem',
                backgroundColor: 'rgba(100, 108, 255, 0.1)',
                border: '1px solid rgba(100, 108, 255, 0.3)',
                color: '#a5b4fc',
                fontSize: '0.82em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>💡</span>
              <span>
                Prior Labs TabPFN Recommended Tip: <strong>{receiptResult.suggested_tip_percentage}%</strong> (based on item count & bill)
              </span>
            </div>
          )}

          <div className="responsive-table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88em', textAlign: 'left', minWidth: '300px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
                  <th style={{ padding: '6px' }}>#</th>
                  <th style={{ padding: '6px' }}>Item</th>
                  <th style={{ padding: '6px', textAlign: 'center' }}>Qty</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {receiptResult.items.map((it) => (
                  <tr key={it.item_id} style={{ borderBottom: '1px solid #222' }}>
                    <td style={{ padding: '6px', color: '#666' }}>{it.item_id}</td>
                    <td style={{ padding: '6px' }}>{it.name}</td>
                    <td style={{ padding: '6px', textAlign: 'center' }}>{it.quantity}</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>{it.total_price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="mobile-stack"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '1rem',
              padding: '0.8rem',
              backgroundColor: '#1b1b1b',
              border: '1px solid #333',
              fontSize: '0.85em',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <span>Subtotal: {receiptResult.currency} {receiptResult.subtotal.toFixed(2)}</span>
            <span>Tax: {receiptResult.currency} {receiptResult.tax_total.toFixed(2)}</span>
            {receiptResult.discount_total > 0 && (
              <span style={{ color: '#10b981' }}>Discount: -{receiptResult.discount_total.toFixed(2)}</span>
            )}
            <span><strong>Grand Total: {receiptResult.currency} {receiptResult.grand_total.toFixed(2)}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}

export default SnapReceipt;
