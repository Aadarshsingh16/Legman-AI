import React, { useEffect } from 'react';
import { useStore } from '../state/store';

export const Toast: React.FC = () => {
  const { state, dispatch } = useStore();
  const toast = state.ui.toast;

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      dispatch({
        type: 'SET_UI',
        payload: { toast: null },
      });
    }, 3200);

    return () => clearTimeout(timer);
  }, [toast, dispatch]);

  if (!toast) return null;

  const handleDismiss = () => {
    dispatch({
      type: 'SET_UI',
      payload: { toast: null },
    });
  };

  return (
    <div className="toast-container" role="status" aria-live="polite">
      <div className={`toast ${toast.kind}`} onClick={handleDismiss}>
        <span>{toast.kind === 'error' ? '⚠️' : 'ℹ️'}</span>
        <span>{toast.text}</span>
      </div>
    </div>
  );
};
