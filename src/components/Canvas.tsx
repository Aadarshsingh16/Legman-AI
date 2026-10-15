import React from 'react';

export const Canvas: React.FC = () => {
  return (
    <div className="canvas" style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div className="world" style={{ position: 'absolute', transformOrigin: '0 0' }}>
        <svg className="wires" style={{ position: 'absolute', overflow: 'visible', width: 1, height: 1 }} />
      </div>
    </div>
  );
};
