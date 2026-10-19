import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { ToastContext, type ToastAction, type ToastApi, type ToastKind } from '../../hooks/toastContext'
import { cn } from './cn'

interface Toast {
  id: number
  message: string
  kind: ToastKind
  action?: ToastAction
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const show = useCallback(
    (message: string, kind: ToastKind = 'info', action?: ToastAction) => {
      const id = nextId.current++
      setToasts((t) => [...t.slice(-3), { id, message, kind, action }])
      // A toast with a button (e.g. Undo) stays a little longer, so there's time to press it.
      window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : action ? 8000 : 3800)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({ show, success: (m) => show(m, 'success'), error: (m) => show(m, 'error') }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-auto sm:left-auto sm:right-0 sm:top-0 sm:items-end"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? XCircle : Info
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                role={t.kind === 'error' ? 'alert' : 'status'}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-paper px-4 py-3 text-sm text-ink shadow-lift"
              >
                <Icon className={cn('mt-0.5 size-5 shrink-0', t.kind === 'success' ? 'text-sage' : t.kind === 'error' ? 'text-rose' : 'text-gold')} />
                <p className="flex-1 leading-relaxed">{t.message}</p>
                {t.action && (
                  <button
                    type="button"
                    onClick={() => {
                      dismiss(t.id)
                      t.action!.onClick()
                    }}
                    className="-my-0.5 shrink-0 rounded-md border border-ink/20 px-2.5 py-0.5 text-sm font-medium text-ink transition hover:bg-cream"
                  >
                    {t.action.label}
                  </button>
                )}
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="rounded p-0.5 text-muted hover:text-ink">
                  <X className="size-4" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
