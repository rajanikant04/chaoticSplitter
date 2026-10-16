interface NavbarProps {
  backendStatus: 'checking' | 'connected' | 'error';
  onPing: () => void;
}

export function Navbar({ backendStatus, onPing }: NavbarProps) {
  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.8rem 1rem',
        borderBottom: '1px solid #2f2f2f',
        backgroundColor: '#171717',
        width: '100%',
        flexWrap: 'wrap',
        gap: '12px',
        boxSizing: 'border-box',
      }}
    >
      {/* Brand Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1.4rem' }}>🧾</span>
        <span style={{ fontWeight: 700, fontSize: '1.15rem', color: '#fff', letterSpacing: '-0.3px' }}>
          Chaotic<span className="accent-text">Splitter</span>
        </span>
      </div>

      {/* Backend Status Indicator */}
      <div
        className="status-badge"
        style={{ margin: 0, padding: '4px 10px', flexShrink: 0 }}
      >
        <span
          className={`status-dot ${
            backendStatus === 'connected'
              ? 'dot-green'
              : backendStatus === 'checking'
              ? 'dot-yellow'
              : 'dot-red'
          }`}
        />
        <span
          style={{
            color: backendStatus === 'connected' ? '#10b981' : '#aaa',
            fontSize: '0.82em',
          }}
        >
          {backendStatus === 'connected'
            ? 'Backend Online'
            : backendStatus === 'checking'
            ? 'Checking...'
            : 'Backend Offline'}
        </span>
        <button
          type="button"
          onClick={onPing}
          style={{
            padding: '2px 8px',
            fontSize: '0.78em',
            marginLeft: '6px',
            border: '1px solid #444',
          }}
        >
          Ping
        </button>
      </div>
    </header>
  );
}

export default Navbar;
