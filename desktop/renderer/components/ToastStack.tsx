import React from 'react'
import type { Toast } from '../hooks/useToast'

interface ToastStackProps {
  toasts: Toast[]
  onDismiss: (id: number) => void
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-card toast-card--${toast.severity}`}
        >
          <span>{toast.message}</span>
          <button
            className="toast-dismiss"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss"
          >
            &#x2715;
          </button>
        </div>
      ))}
    </div>
  )
}
