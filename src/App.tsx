import React from 'react';

export const App: React.FC = () => {
  return (
    <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <header style={{ height: '48px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 16px', background: 'var(--panel)' }}>
        <h1 style={{ fontSize: '15px', fontWeight: 600 }}>Workflow Builder</h1>
      </header>
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        <aside style={{ width: '220px', borderRight: '1px solid var(--border)', background: 'var(--panel)', padding: '12px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em' }}>
            Palette
          </div>
        </aside>
        <main style={{ flex: 1, position: 'relative', background: 'var(--bg)' }}>
          <div style={{ padding: '24px', color: 'var(--muted)' }}>
            Canvas Shell
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
