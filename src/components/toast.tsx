'use client';

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error';
  onDismiss: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'success', onDismiss, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-[9999] px-6 py-4 rounded-xl shadow-2xl text-sm font-medium transition-all animate-slide-up ${
        type === 'error'
          ? 'bg-red-500/90 text-white border border-red-400/30'
          : 'bg-green-500/90 text-white border border-green-400/30'
      }`}
      style={{ backdropFilter: 'blur(8px)' }}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">{type === 'error' ? '✕' : '✓'}</span>
        <span>{message}</span>
        <button
          onClick={onDismiss}
          className="ml-2 text-white/70 hover:text-white text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
