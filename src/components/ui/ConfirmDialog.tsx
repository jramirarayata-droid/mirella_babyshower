import type { ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  loadingText?: string
  destructive?: boolean
  tone?: 'wedding' | 'admin'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading,
  loadingText,
  destructive,
  tone = 'admin',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      locked={loading}
      tone={tone}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading} className="sm:min-w-28">
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            loadingText={loadingText}
            data-autofocus
            className="sm:min-w-40"
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className={tone === 'wedding' ? 'text-center text-ink-soft' : 'text-ink-soft'}>{message}</div>
    </Modal>
  )
}
