import React from 'react';

export const Toolbar: React.FC = () => {
  return (
    <div className="toolbar" role="toolbar" aria-label="Editor controls">
      <button aria-label="Undo">Undo</button>
      <button aria-label="Redo">Redo</button>
    </div>
  );
};
