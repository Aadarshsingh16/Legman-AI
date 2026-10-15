import React from 'react';
import { NODE_TEMPLATES } from '../core/nodeTemplates';

export interface PaletteProps {
  onAddNode?: (templateType: string) => void;
  onDragStart?: (e: React.DragEvent, templateType: string) => void;
}

export const Palette: React.FC<PaletteProps> = ({ onAddNode, onDragStart }) => {
  const templates = Object.values(NODE_TEMPLATES);
  const triggers = templates.filter((t) => t.category === 'trigger');
  const actions = templates.filter((t) => t.category === 'action');

  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('text/plain', type);
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart?.(e, type);
  };

  return (
    <aside className="palette" aria-label="Node Palette">
      <div>
        <div className="palette-section-title">Triggers</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {triggers.map((t) => (
            <div
              key={t.type}
              className="palette-item"
              draggable
              onDragStart={(e) => handleDragStart(e, t.type)}
              onClick={() => onAddNode?.(t.type)}
              title={`Drag onto canvas or click to add ${t.label}`}
            >
              <div className="palette-item-badge trigger" />
              <span>{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="palette-section-title">Actions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {actions.map((t) => (
            <div
              key={t.type}
              className="palette-item"
              draggable
              onDragStart={(e) => handleDragStart(e, t.type)}
              onClick={() => onAddNode?.(t.type)}
              title={`Drag onto canvas or click to add ${t.label}`}
            >
              <div className="palette-item-badge action" />
              <span>{t.label}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
