import { useState, useEffect } from 'react';
import { Navbar } from './components/navbar';
import { Footer } from './components/footer';
import { GroupSetup } from './components/groupSetup';
import { SnapReceipt } from './components/snapReceipt';
import { ReceiptPreviewPanel } from './components/receiptPreviewPanel';
import { ExplainSplit } from './components/explainSplit';
import { VerifyItems } from './components/verifyItems';
import { SettlePay } from './components/settlePay';
import { pingBackendService, type ConnectionStatus } from './utils/checkConnection';
import type { ReceiptData, VoiceSplitPlan } from './services/api';

export function App() {
  const [backendStatus, setBackendStatus] = useState<ConnectionStatus>('checking');
  const [backendMessage, setBackendMessage] = useState<string>('');
  
  // Group state
  const [isGroupConfigured, setIsGroupConfigured] = useState<boolean>(false);
  const [groupName, setGroupName] = useState<string>('');
  const [members, setMembers] = useState<string[]>([]);

  // Receipt & Workflow state
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);
  const [splitPlan, setSplitPlan] = useState<VoiceSplitPlan | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);

  useEffect(() => {
    pingBackend();
  }, []);

  const pingBackend = async () => {
    setBackendStatus('checking');
    const result = await pingBackendService();
    setBackendStatus(result.status);
    setBackendMessage(result.message);
  };

  const handleGroupConfirmed = (name: string, groupMembers: string[]) => {
    setGroupName(name);
    setMembers(groupMembers);
    setIsGroupConfigured(true);
    setCurrentStep(1);
  };

  const handleReceiptProcessed = (data: any, imageUrl?: string) => {
    setReceiptData(data);
    if (imageUrl) {
      setReceiptImageUrl(imageUrl);
    }
    // Automatically advance to Step 2: Explain Split once receipt items are extracted
    setCurrentStep(2);
  };

  const steps = [
    { id: 1, title: '1. Snap Receipt' },
    { id: 2, title: '2. Explain Split' },
    { id: 3, title: '3. Verify Items' },
    { id: 4, title: '4. Settle & Pay' },
  ];

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar backendStatus={backendStatus} onPing={pingBackend} />

      {/* Connection warning banner */}
      {backendStatus === 'error' && (
        <div
          className="card"
          style={{
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            marginTop: '1rem',
          }}
        >
          <p style={{ color: '#f87171', margin: 0, fontWeight: 500 }}>
            ⚠️ {backendMessage}
          </p>
          <p style={{ fontSize: '0.8em', marginTop: '6px', color: '#888', wordBreak: 'break-all' }}>
            Run backend: <code>cd backend ; .\venv\python.exe -m uvicorn app.main:app --reload --port 8000</code>
          </p>
        </div>
      )}

      {/* Phase 1: Group Setup (shown if group is not configured yet) */}
      {!isGroupConfigured ? (
        <GroupSetup onGroupConfirmed={handleGroupConfirmed} />
      ) : (
        /* Phase 2: 4-Step Splitter Workflow (shown after group is configured) */
        <>
          {/* Active Group Header Banner */}
          <div
            className="mobile-stack"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#1b1b1b',
              border: '1px solid #333',
              padding: '0.8rem 1rem',
              marginTop: '1.2rem',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ wordBreak: 'break-word' }}>
              <span style={{ color: '#888', fontSize: '0.82em' }}>ACTIVE GROUP: </span>
              <strong style={{ color: '#fff', fontSize: '1em' }}>{groupName}</strong>
              <span style={{ color: '#646cff', marginLeft: '8px', fontSize: '0.88em' }}>
                ({members.length} friends: {members.join(', ')})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsGroupConfigured(false)}
              style={{
                padding: '3px 10px',
                fontSize: '0.8em',
                border: '1px solid #444',
                color: '#aaa',
              }}
            >
              Edit Group
            </button>
          </div>

          {/* Responsive Step Selector */}
          <nav aria-label="Workflow Steps" className="steps-nav">
            {steps.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`step-btn ${currentStep === s.id ? 'active' : ''}`}
                onClick={() => setCurrentStep(s.id)}
                title={s.title}
              >
                {s.title}
              </button>
            ))}
          </nav>

          {/* Persistent Receipt Reference Preview for Steps 2, 3, 4 */}
          {currentStep > 1 && receiptImageUrl && (
            <ReceiptPreviewPanel
              imageUrl={receiptImageUrl}
              receiptData={receiptData}
              onRetake={() => setCurrentStep(1)}
            />
          )}

          {/* Active Step Modular Component */}
          {currentStep === 1 && (
            <SnapReceipt
              groupName={groupName}
              members={members}
              initialImageUrl={receiptImageUrl}
              onImageChange={(url) => setReceiptImageUrl(url)}
              onReceiptProcessed={handleReceiptProcessed}
            />
          )}
          {currentStep === 2 && (
            receiptData ? (
              <ExplainSplit
                groupName={groupName}
                members={members}
                receiptData={receiptData}
                onSplitPlanGenerated={(plan) => {
                  setSplitPlan(plan);
                  setCurrentStep(3);
                }}
              />
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🧾</div>
                <p style={{ color: '#f59e0b', margin: 0, fontWeight: 600 }}>
                  Please snap or upload a receipt photo first in Step 1.
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  style={{
                    marginTop: '1.2rem',
                    padding: '0.7em 1.4em',
                    backgroundColor: '#646cff',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                  }}
                >
                  ← Go to Step 1: Snap Receipt
                </button>
              </div>
            )
          )}
          {currentStep === 3 && (
            <VerifyItems
              groupName={groupName}
              members={members}
              receiptData={receiptData}
              splitPlan={splitPlan}
              onPlanConfirmed={(updatedReceipt, updatedPlan) => {
                setReceiptData(updatedReceipt);
                setSplitPlan(updatedPlan);
                setCurrentStep(4);
              }}
              onBackToExplain={() => setCurrentStep(2)}
            />
          )}
          {currentStep === 4 && (
            <SettlePay
              groupName={groupName}
              members={members}
              receiptData={receiptData}
              splitPlan={splitPlan}
              onBackToVerify={() => setCurrentStep(3)}
            />
          )}
        </>
      )}

      <Footer />
    </div>
  );
}

export default App;
