import React, { useState, useEffect, useRef } from 'react';
import { parseGraph } from '../core/schema';
import { Graph } from '../core/types';
import exampleWorkflowJson from '../samples/example.json';

export interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (
    graph: Graph,
    meta?: { name: string },
    viewport?: { x: number; y: number; zoom: number }
  ) => void;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [jsonText, setJsonText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setErrors([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleValidateAndImport = () => {
    setErrors([]);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonText);
    } catch {
      setErrors(['Invalid JSON syntax: could not parse string']);
      return;
    }

    const res = parseGraph(parsedJson);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }

    onImportSuccess(res.graph, res.meta, res.viewport);
    onClose();
  };

  const handleLoadExample = () => {
    const formatted = JSON.stringify(exampleWorkflowJson, null, 2);
    setJsonText(formatted);
    setErrors([]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content);
      setErrors([]);
    };
    reader.readAsText(file);
    // clear it, otherwise picking the same file again won't fire onChange
    e.target.value = '';
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog"
        style={{
          width: '640px',
          maxWidth: '100%',
          maxHeight: '90vh',
          backgroundColor: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Import Workflow</h2>
          <button
            type="button"
            className="btn"
            onClick={onClose}
            style={{ width: '28px', height: '28px', padding: 0, justifyContent: 'center' }}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn"
              onClick={() => fileInputRef.current?.click()}
            >
              📁 Choose JSON file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button
              type="button"
              className="btn"
              onClick={handleLoadExample}
            >
              Load Example Template
            </button>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--muted)', marginBottom: '6px' }}>
              Or paste workflow JSON:
            </label>
            <textarea
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                if (errors.length > 0) setErrors([]);
              }}
              placeholder='Paste workflow JSON ({"version": 1, "nodes": [...], "edges": [...]})'
              style={{
                width: '100%',
                height: '240px',
                fontFamily: 'monospace',
                fontSize: '12px',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '10px',
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>

          {errors.length > 0 && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--bad)',
                borderRadius: '6px',
                padding: '12px 16px',
                fontSize: '12px',
                color: '#fca5a5',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>
                Found {errors.length} validation {errors.length === 1 ? 'error' : 'errors'}:
              </div>
              <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn active"
            disabled={!jsonText.trim()}
            onClick={handleValidateAndImport}
          >
            Import Workflow
          </button>
        </div>
      </div>
    </div>
  );
};
