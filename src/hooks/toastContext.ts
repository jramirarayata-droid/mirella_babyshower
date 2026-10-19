import { createContext } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

/** An optional button in the toast, e.g. "Undo". */
export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastApi {
  show: (message: string, kind?: ToastKind, action?: ToastAction) => void
  success: (message: string) => void
  error: (message: string) => void
}

export const ToastContext = createContext<ToastApi | null>(null)
