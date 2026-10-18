import { useState, useEffect, useCallback } from 'react';
import {
  verifyAndCalculateSettlement,
  type LineItem,
  type ReceiptData,
  type VoiceSplitPlan,
  type ItemShare,
  type SettlementSummary,
} from '../services/api';

export interface VerifyItemsProps {
  groupName: string;
  members: string[];
  receiptData?: ReceiptData | null;
  splitPlan?: VoiceSplitPlan | null;
  onPlanConfirmed?: (updatedReceipt: ReceiptData, updatedPlan: VoiceSplitPlan) => void;
  onBackToExplain?: () => void;
}

// Helper to construct item_id -> list of assigned participant names
function buildInitialAllocations(
  items: LineItem[] = [],
  allocations: ItemShare[] = []
): Record<number, string[]> {
  const map: Record<number, string[]> = {};

  items.forEach((item) => {
    map[item.item_id] = [];
  });

  allocations.forEach((alloc) => {
    if (!map[alloc.item_id]) {
      map[alloc.item_id] = [];
    }
    if (!map[alloc.item_id].includes(alloc.person)) {
      map[alloc.item_id].push(alloc.person);
    }
  });

  return map;
}

export function VerifyItems({
  groupName,
  members,
  receiptData,
  splitPlan,
  onPlanConfirmed,
  onBackToExplain,
}: VerifyItemsProps) {
  // 1. Component State & Data Structures
  const [editableItems, setEditableItems] = useState<LineItem[]>(() =>
    receiptData?.items ? receiptData.items.map((it) => ({ ...it })) : []
  );

  const [allocationsMap, setAllocationsMap] = useState<Record<number, string[]>>(() =>
    buildInitialAllocations(receiptData?.items, splitPlan?.allocations)
  );

  // Backend Math Calculation State
  const [calculationSummary, setCalculationSummary] = useState<SettlementSummary | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [calcError, setCalcError] = useState<string>('');

  // Sync state when props update
  useEffect(() => {
    if (receiptData?.items) {
      setEditableItems(receiptData.items.map((it) => ({ ...it })));
      setAllocationsMap(buildInitialAllocations(receiptData.items, splitPlan?.allocations));
    }
  }, [receiptData, splitPlan]);

  // Construct updated Receipt and Plan objects
  const getUpdatedData = useCallback(() => {
    const updatedAllocations: ItemShare[] = [];
    Object.entries(allocationsMap).forEach(([itemIdStr, people]) => {
      const itemId = Number(itemIdStr);
      people.forEach((person) => {
        updatedAllocations.push({
          item_id: itemId,
          person,
          weight: 1.0,
        });
      });
    });

    const updatedPlan: VoiceSplitPlan = {
      participants: members.length > 0 ? members : ['Me'],
      allocations: updatedAllocations,
      unclaimed_rule: 'split_all',
      reasoning_summary: splitPlan?.reasoning_summary || 'Verified and fine-tuned by user.',
    };

    const itemsSubtotal = editableItems.reduce((acc, it) => acc + (Number(it.total_price) || 0), 0);
    const tax = receiptData?.tax_total ?? 0;
    const tip = receiptData?.service_charge_or_tip ?? 0;
    const discount = receiptData?.discount_total ?? 0;
    const grandTotal = Math.max(0, itemsSubtotal + tax + tip - discount);

    const updatedReceipt: ReceiptData = {
      merchant_name: receiptData?.merchant_name || 'Restaurant',
      currency: receiptData?.currency || 'INR',
      items: editableItems,
      subtotal: itemsSubtotal,
      tax_total: tax,
      service_charge_or_tip: tip,
      discount_total: discount,
      grand_total: grandTotal,
    };

    return { updatedReceipt, updatedPlan };
  }, [allocationsMap, editableItems, members, receiptData, splitPlan]);

  // Call backend /api/verify to run deterministic Python Decimal math engine
  const runMathVerification = useCallback(async () => {
    if (editableItems.length === 0) return;

    setIsCalculating(true);
    setCalcError('');

    try {
      const { updatedReceipt, updatedPlan } = getUpdatedData();
      const result = await verifyAndCalculateSettlement({
        receipt: updatedReceipt,
        plan: updatedPlan,
        payer_name: members[0] || 'Me',
      });
      setCalculationSummary(result);
    } catch (err: any) {
      console.error('Math engine verification failed:', err);
      setCalcError(err?.response?.data?.detail || 'Failed to calculate split via math engine.');
    } finally {
      setIsCalculating(false);
    }
  }, [editableItems.length, getUpdatedData, members]);

  // Auto-run calculation whenever allocations, items, or unclaimedRule changes
  useEffect(() => {
    const timer = setTimeout(() => {
      runMathVerification();
    }, 250);
    return () => clearTimeout(timer);
  }, [runMathVerification]);

  // --- Handlers ---
  const handleToggleMember = (itemId: number, memberName: string) => {
    setAllocationsMap((prev) => {
      const currentList = prev[itemId] || [];
      const isAlreadyAssigned = currentList.includes(memberName);
      const updatedList = isAlreadyAssigned
        ? currentList.filter((m) => m !== memberName)
        : [...currentList, memberName];

      return {
        ...prev,
        [itemId]: updatedList,
      };
    });
  };

  const handleSelectAllForDish = (itemId: number) => {
    setAllocationsMap((prev) => ({
      ...prev,
      [itemId]: [...members],
    }));
  };

  const handleClearDish = (itemId: number) => {
    setAllocationsMap((prev) => ({
      ...prev,
      [itemId]: [],
    }));
  };

  const handleResetToOriginalPlan = () => {
    setAllocationsMap(buildInitialAllocations(editableItems, splitPlan?.allocations));
  };

  const handleUpdateItemField = (
    itemId: number,
    field: 'name' | 'quantity' | 'total_price',
    value: string | number
  ) => {
    setEditableItems((prev) =>
      prev.map((item) => {
        if (item.item_id !== itemId) return item;
        if (field === 'name') return { ...item, name: String(value) };
        const numVal = Math.max(0, Number(value) || 0);
        return { ...item, [field]: numVal };
      })
    );
  };

  const handleAddItem = () => {
    const nextId = editableItems.length > 0
      ? Math.max(...editableItems.map((it) => it.item_id)) + 1
      : 1;
    const newItem: LineItem = {
      item_id: nextId,
      name: `Dish #${nextId}`,
      quantity: 1,
      total_price: 150,
    };
    setEditableItems((prev) => [...prev, newItem]);
    setAllocationsMap((prev) => ({
      ...prev,
      [nextId]: [...members],
    }));
  };

  const handleDeleteItem = (itemId: number) => {
    setEditableItems((prev) => prev.filter((it) => it.item_id !== itemId));
    setAllocationsMap((prev) => {
      const nextMap = { ...prev };
      delete nextMap[itemId];
      return nextMap;
    });
  };

  const handleConfirmAndProceed = () => {
    const { updatedReceipt, updatedPlan } = getUpdatedData();
    if (onPlanConfirmed) {
      onPlanConfirmed(updatedReceipt, updatedPlan);
    }
  };

  // Quick lookup of participants assigned to an item
  const getItemCostPerPerson = (price: number, assignedCount: number) => {
    if (assignedCount === 0) return 0;
    return price / assignedCount;
  };

  return (
    <div className="card" style={{ flex: 1, textAlign: 'left' }}>
      {/* Step Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ margin: 0 }}>3. Verify Items & Live Calculation</h2>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: '0.9em' }}>
            Fine-tune dish assignments for <strong>{groupName}</strong>. Connected to Python Decimal math engine.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handleResetToOriginalPlan}
            style={{
              padding: '5px 12px',
              fontSize: '0.8em',
              border: '1px solid #444',
              backgroundColor: '#1b1b1b',
              color: '#ccc',
            }}
            title="Reset allocations back to Gemma AI suggestions"
          >
            ↺ Reset to AI Plan
          </button>
          <button
            type="button"
            onClick={handleAddItem}
            style={{
              padding: '5px 12px',
              fontSize: '0.8em',
              border: '1px solid #10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              fontWeight: 600,
            }}
          >
            + Add Dish
          </button>
        </div>
      </div>

      {/* Gemma 4 Reasoning Note */}
      {splitPlan?.reasoning_summary && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(100, 108, 255, 0.08)',
            border: '1px solid #646cff',
            fontSize: '0.86em',
          }}
        >
          <strong style={{ color: '#a5b4fc' }}>💡 AI Reasoning Plan: </strong>
          <span style={{ color: '#ddd' }}>{splitPlan.reasoning_summary}</span>
        </div>
      )}

      {/* Live Math Engine Settlement Bar */}
      <div
        style={{
          marginTop: '1.2rem',
          padding: '1rem',
          backgroundColor: '#181818',
          border: '1px solid #333',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.1rem' }}>⚙️</span>
            <strong style={{ fontSize: '0.92em', color: '#fff' }}>MATH ENGINE STATUS:</strong>
            {isCalculating ? (
              <span style={{ fontSize: '0.82em', color: '#646cff' }}>Calculating...</span>
            ) : calculationSummary?.zero_leakage_verified ? (
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
            ) : (
              <span style={{ fontSize: '0.82em', color: '#888' }}>Ready</span>
            )}
          </div>
          {calculationSummary && (
            <div style={{ fontSize: '0.88em', color: '#ccc' }}>
              Receipt Total: <strong style={{ color: '#10b981' }}>₹{calculationSummary.grand_total.toFixed(2)}</strong>
              {' '}| Sum of Shares: <strong>₹{calculationSummary.sum_of_shares.toFixed(2)}</strong>
            </div>
          )}
        </div>

        {/* Live Participant Shares Chips */}
        {calculationSummary?.participants && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '0.8rem' }}>
            {calculationSummary.participants.map((p) => (
              <div
                key={p.person}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#202020',
                  border: '1px solid #444',
                  fontSize: '0.85em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ fontWeight: 600, color: '#fff' }}>{p.person}:</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>₹{p.final_total.toFixed(2)}</span>
                <span style={{ color: '#777', fontSize: '0.8em' }}>
                  (food: ₹{p.subtotal.toFixed(0)} + tax: ₹{p.tax_share.toFixed(1)})
                </span>
              </div>
            ))}
          </div>
        )}

        {calcError && (
          <p style={{ margin: '8px 0 0', color: '#ef4444', fontSize: '0.82em' }}>
            ⚠️ {calcError}
          </p>
        )}
      </div>


      {/* Line Items Checklist */}
      <div style={{ marginTop: '1.2rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {editableItems.map((item) => {
          const assigned = allocationsMap[item.item_id] || [];
          const costEach = getItemCostPerPerson(item.total_price, assigned.length);

          return (
            <div
              key={item.item_id}
              style={{
                backgroundColor: '#1b1b1b',
                border: assigned.length === 0 ? '1px dashed #f59e0b' : '1px solid #333',
                padding: '0.9rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {/* Item Header row: Name, Quantity, Total Price, Delete */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
                  <span
                    style={{
                      fontSize: '0.75em',
                      backgroundColor: '#2a2a2a',
                      color: '#888',
                      padding: '2px 6px',
                      fontWeight: 700,
                    }}
                  >
                    #{item.item_id}
                  </span>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleUpdateItemField(item.item_id, 'name', e.target.value)}
                    style={{
                      flex: 1,
                      backgroundColor: 'transparent',
                      border: '1px solid transparent',
                      borderBottom: '1px solid #444',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.95em',
                      padding: '2px 4px',
                    }}
                    placeholder="Dish Name"
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.8em', color: '#888' }}>Qty:</span>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => handleUpdateItemField(item.item_id, 'quantity', e.target.value)}
                      style={{
                        width: '45px',
                        padding: '2px 4px',
                        fontSize: '0.85em',
                        textAlign: 'center',
                        backgroundColor: '#141414',
                        border: '1px solid #444',
                        color: '#fff',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.8em', color: '#888' }}>₹</span>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={item.total_price}
                      onChange={(e) => handleUpdateItemField(item.item_id, 'total_price', e.target.value)}
                      style={{
                        width: '80px',
                        padding: '2px 4px',
                        fontSize: '0.88em',
                        textAlign: 'right',
                        backgroundColor: '#141414',
                        border: '1px solid #444',
                        color: '#10b981',
                        fontWeight: 600,
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.item_id)}
                    style={{
                      padding: '2px 8px',
                      fontSize: '0.8em',
                      border: '1px solid #444',
                      backgroundColor: 'transparent',
                      color: '#ef4444',
                    }}
                    title="Delete item"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Participant Tappable Chips */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  paddingTop: '6px',
                  borderTop: '1px solid #282828',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78em', color: '#888', marginRight: '4px' }}>
                    Shared by:
                  </span>
                  {members.map((member) => {
                    const isSelected = assigned.includes(member);
                    return (
                      <button
                        key={member}
                        type="button"
                        onClick={() => handleToggleMember(item.item_id, member)}
                        style={{
                          padding: '3px 10px',
                          fontSize: '0.8em',
                          border: isSelected ? '1px solid #10b981' : '1px solid #383838',
                          backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.15)' : '#161616',
                          color: isSelected ? '#10b981' : '#aaa',
                          fontWeight: isSelected ? 600 : 400,
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {member}
                      </button>
                    );
                  })}
                </div>

                {/* Per-item Quick Actions & Share Cost */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleSelectAllForDish(item.item_id)}
                    style={{
                      padding: '2px 7px',
                      fontSize: '0.74em',
                      border: '1px solid #444',
                      backgroundColor: '#161616',
                      color: '#bbb',
                    }}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClearDish(item.item_id)}
                    style={{
                      padding: '2px 7px',
                      fontSize: '0.74em',
                      border: '1px solid #444',
                      backgroundColor: '#161616',
                      color: '#888',
                    }}
                  >
                    Clear
                  </button>

                  <div style={{ marginLeft: '6px' }}>
                    {assigned.length > 0 ? (
                      <span style={{ fontSize: '0.8em', color: '#10b981', fontWeight: 600 }}>
                        ₹{costEach.toFixed(2)} / person ({assigned.length})
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.8em', color: '#10b981', fontWeight: 500 }}>
                        ✓ Shared equally by all friends
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation & Confirmation Buttons */}
      <div
        style={{
          marginTop: '1.8rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          borderTop: '1px solid #333',
          paddingTop: '1.2rem',
        }}
      >
        <button
          type="button"
          onClick={onBackToExplain}
          style={{
            padding: '0.7em 1.2em',
            fontSize: '0.9em',
            border: '1px solid #444',
            backgroundColor: '#1b1b1b',
            color: '#ccc',
          }}
        >
          ← Back to Explain Split
        </button>

        <button
          type="button"
          onClick={handleConfirmAndProceed}
          style={{
            padding: '0.8em 1.6em',
            fontSize: '0.95em',
            fontWeight: 700,
            border: 'none',
            backgroundColor: '#646cff',
            color: '#fff',
          }}
        >
          Proceed to Settle & Pay →
        </button>
      </div>
    </div>
  );
}

export default VerifyItems;


