export function Footer() {
  return (
    <footer
      style={{
        marginTop: 'auto',
        padding: '1.2rem 1rem',
        borderTop: '1px solid #2f2f2f',
        backgroundColor: '#171717',
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        boxSizing: 'border-box',
        fontSize: '0.85rem',
        color: '#777',
      }}
    >
      <div>
        <span>Chaotic</span>
        <span className="accent-text">Splitter</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span>Made with ❤️ </span>
      </div>
    </footer>
  );
}

export default Footer;
