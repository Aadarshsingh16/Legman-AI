import React from 'react';
import { useStore } from '../state/store';
import { canRedo, canUndo, getRedoLabel, getUndoLabel } from '../core/history';

export interface ToolbarProps {
  onExport?: () => void;
  onCopyJson?: () => void;
  onImport?: () => void;
  onLoadExample?: () => void;
  onClear?: () => void;
  onFitToView?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onExport,
  onCopyJson,
  onImport,
  onLoadExample,
  onClear,
  onFitToView,
}) => {
  const { state, dispatch } = useStore();
  const { history, ui } = state;

  const undoAvailable = canUndo(history);
  const redoAvailable = canRedo(history);
  const undoLabel = getUndoLabel(history);
  const redoLabel = getRedoLabel(history);

  const handleUndo = () => {
    if (undoAvailable) {
      dispatch({ type: 'UNDO' });
    }
  };

  const handleRedo = () => {
    if (redoAvailable) {
      dispatch({ type: 'REDO' });
    }
  };

  const toggleConnectorMode = () => {
    const nextMode = ui.connectorMode === 'bezier' ? 'orthogonal' : 'bezier';
    dispatch({
      type: 'SET_UI',
      payload: { connectorMode: nextMode },
    });
  };

  const toggleSnap = () => {
    dispatch({
      type: 'SET_UI',
      payload: { snap: !ui.snap },
    });
  };

  return (
    <div className="toolbar" role="toolbar" aria-label="Editor controls">
      <div className="toolbar-group">
        <button
          type="button"
          className="btn"
          onClick={handleUndo}
          disabled={!undoAvailable}
          title={undoLabel ? `Undo (${undoLabel}) [Ctrl+Z]` : 'Undo [Ctrl+Z]'}
          aria-label="Undo"
        >
          <span>⟲</span> Undo
        </button>
        <button
          type="button"
          className="btn"
          onClick={handleRedo}
          disabled={!redoAvailable}
          title={redoLabel ? `Redo (${redoLabel}) [Ctrl+Y]` : 'Redo [Ctrl+Y]'}
          aria-label="Redo"
        >
          <span>⟳</span> Redo
        </button>

        <div className="toolbar-divider" />

        <button
          type="button"
          className={`btn ${ui.connectorMode === 'orthogonal' ? 'active' : ''}`}
          onClick={toggleConnectorMode}
          title="Toggle connector routing (Bezier vs Orthogonal)"
          aria-label="Toggle connector mode"
        >
          Connector: {ui.connectorMode === 'bezier' ? 'Bezier' : 'Orthogonal'}
        </button>

        <button
          type="button"
          className={`btn ${ui.snap ? 'active' : ''}`}
          onClick={toggleSnap}
          title="Toggle grid snap (20px)"
          aria-label="Toggle grid snap"
        >
          Snap: {ui.snap ? 'ON' : 'OFF'}
        </button>

        {onFitToView && (
          <button
            type="button"
            className="btn"
            onClick={onFitToView}
            title="Fit workflow nodes to viewport"
            aria-label="Fit to view"
          >
            Fit View
          </button>
        )}
      </div>

      <div className="toolbar-group">
        {onLoadExample && (
          <button
            type="button"
            className="btn"
            onClick={onLoadExample}
            title="Load sample workflow"
            aria-label="Load example"
          >
            Load Example
          </button>
        )}

        {onImport && (
          <button
            type="button"
            className="btn"
            onClick={onImport}
            title="Import workflow JSON"
            aria-label="Import JSON"
          >
            Import
          </button>
        )}

        {onExport && (
          <button
            type="button"
            className="btn"
            onClick={onExport}
            title="Download workflow as JSON file"
            aria-label="Export JSON"
          >
            Export JSON
          </button>
        )}

        {onCopyJson && (
          <button
            type="button"
            className="btn"
            onClick={onCopyJson}
            title="Copy workflow JSON to clipboard"
            aria-label="Copy JSON"
          >
            Copy JSON
          </button>
        )}

        {onClear && (
          <button
            type="button"
            className="btn"
            onClick={onClear}
            title="Clear canvas"
            aria-label="Clear canvas"
          >
            Clear
          </button>
        )}

        <div className="toolbar-divider" />

        <span
          style={{
            fontSize: '11px',
            color: 'var(--muted)',
            fontFamily: 'monospace',
            padding: '2px 6px',
            background: 'var(--bg)',
            borderRadius: '4px',
            border: '1px solid var(--border)',
          }}
          title="History steps in undo stack"
        >
          History: {history.past.length}
        </span>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--muted)',
            fontFamily: 'monospace',
            padding: '2px 6px',
            background: 'var(--bg)',
            borderRadius: '4px',
            border: '1px solid var(--border)',
          }}
          title="Current zoom level"
        >
          {Math.round(ui.viewport.zoom * 100)}%
        </span>
      </div>
    </div>
  );
};
