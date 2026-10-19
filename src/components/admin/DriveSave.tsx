import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ExternalLink, HardDriveUpload, TriangleAlert } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useUnsavedChanges } from '../../hooks/unsavedChanges'
import {
  driveClientId,
  driveFolderUrl,
  DriveError,
  ensureFolder,
  loadGis,
  looksLikeClientId,
  saveToDrive,
  setDriveClientId,
  signInToDrive,
  type DriveItem,
  type DriveProgress,
  type DriveTarget,
} from '../../services/googleDriveService'

interface Props {
  target: DriveTarget
  /** Folder name in Drive, e.g. "Baby Santos — Guest Photos". */
  folderName: string
  /** What to save — loaded when the admin clicks Start. */
  loadItems: () => Promise<DriveItem[]>
  /** e.g. "guest photos" / "photos". */
  noun: string
  disabled?: boolean
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'running'; p: DriveProgress | null; step: string }
  | { kind: 'done'; p: DriveProgress; folderId: string }
  | { kind: 'stopped'; message: string; p: DriveProgress | null; folderId: string | null }

/** "Save to Google Drive": the button and its window (progress, cancel, Client ID). */
export function DriveSaveButton({ target, folderName, loadItems, noun, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [clientId, setClientId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState(false)
  const [idDraft, setIdDraft] = useState('')
  const [idError, setIdError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)
  const [stopping, setStopping] = useState(false)
  const running = phase.kind === 'running'

  // While saving: warn before leaving the page or closing the tab.
  useUnsavedChanges(running, 'Saving photos to Google Drive')

  useEffect(() => {
    if (open) void loadGis().catch(() => undefined)
  }, [open])

  useEffect(() => {
    if (!open || clientId !== null) return
    void driveClientId().then((id) => {
      setClientId(id)
      setIdDraft(id)
      setEditingId(!id)
    })
  }, [open, clientId])

  const saveId = async () => {
    if (!looksLikeClientId(idDraft)) {
      setIdError('That doesn’t look like a Google Client ID — it ends in “.apps.googleusercontent.com”.')
      return
    }
    setIdError(null)
    await setDriveClientId(idDraft)
    setClientId(idDraft.trim())
    setEditingId(false)
  }

  const start = async () => {
    if (!clientId) return
    const ac = new AbortController()
    abort.current = ac
    let folderId: string | null = null
    let last: DriveProgress | null = null
    try {
      setPhase({ kind: 'running', p: null, step: 'Signing in to Google…' })
      const t = await signInToDrive(clientId) // first thing after the click, so the pop-up isn't blocked
      setPhase({ kind: 'running', p: null, step: 'Finding your Drive folder…' })
      folderId = await ensureFolder(t, target, folderName, ac.signal)
      setPhase({ kind: 'running', p: null, step: `Checking which ${noun} are already saved…` })
      const items = await loadItems()
      const p = await saveToDrive(
        t,
        folderId,
        items,
        (x) => {
          last = x
          setPhase({ kind: 'running', p: x, step: '' })
        },
        ac.signal,
      )
      setPhase({ kind: 'done', p, folderId })
    } catch (e) {
      const message = e instanceof DriveError || e instanceof Error ? e.message : 'Something went wrong.'
      setPhase({ kind: 'stopped', message, p: last, folderId })
    } finally {
      abort.current = null
      setStopping(false)
    }
  }

  const close = () => {
    if (running) return
    setOpen(false)
    setPhase({ kind: 'idle' })
  }

  const pct = (p: DriveProgress | null) => (p && p.total ? Math.round((p.done / p.total) * 100) : 0)
  const bar = (p: DriveProgress | null) => (
    <div className="mt-3">
      <div role="progressbar" aria-label={`Saving ${noun} to Google Drive`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct(p)} className="h-2.5 overflow-hidden rounded-full bg-cream">
        <div className="h-full rounded-full bg-gold transition-[width] duration-300" style={{ width: `${pct(p)}%` }} />
      </div>
      {p && (
        <p data-drive-progress className="mt-2 text-sm text-ink-soft">
          {p.done} of {p.total} · {p.uploaded} saved now{p.skipped ? ` · ${p.skipped} already in Drive` : ''}
          {p.failed ? ` · ${p.failed} couldn’t be saved` : ''}
        </p>
      )}
    </div>
  )

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={disabled} icon={<HardDriveUpload aria-hidden="true" className="size-4" />}>
        Save to Google Drive
      </Button>
      <Modal
        open={open}
        onClose={close}
        locked={running}
        title="Save to Google Drive"
        description={`Copies every ${target === 'guest' ? 'shown guest photo' : 'photo'} at full size into the folder “${folderName}” in your Google Drive. Running it again only adds new ones.`}
        footer={
          running ? (
            <Button
              variant="danger-quiet"
              disabled={stopping}
              onClick={() => {
                setStopping(true)
                abort.current?.abort()
              }}
            >
              {stopping ? 'Stopping after the photos in progress…' : 'Cancel'}
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={close}>
                Close
              </Button>
              {clientId && !editingId && phase.kind !== 'done' && (
                <Button onClick={() => void start()} icon={<HardDriveUpload aria-hidden="true" className="size-4" />}>
                  {phase.kind === 'stopped' ? 'Try again' : 'Start'}
                </Button>
              )}
            </>
          )
        }
      >
        <div className="space-y-4 text-sm">
          {/* Client ID: set once, changeable any time */}
          {clientId !== null && (editingId ? (
            <div className="rounded-lg border border-line bg-cream/50 p-4">
              <label className="block">
                <span className="font-medium text-ink">Google Client ID</span>
                <input
                  value={idDraft}
                  onChange={(e) => setIdDraft(e.target.value)}
                  placeholder="1234567890-abc….apps.googleusercontent.com"
                  className="input-base mt-1.5 w-full font-mono text-[0.85rem]"
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
              {idError && (
                <p role="alert" className="mt-2 text-rose">
                  {idError}
                </p>
              )}
              <p className="mt-2 text-xs text-muted">
                From Google Cloud Console → APIs &amp; Services → Credentials (an “OAuth client ID” of type Web application). It isn’t secret. Add this website’s address under “Authorised JavaScript origins”.
              </p>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => void saveId()} disabled={!idDraft.trim()}>
                  Save Client ID
                </Button>
                {clientId && (
                  <Button variant="ghost" onClick={() => setEditingId(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ) : (
            !running && (
              <p className="text-xs text-muted">
                Google Client ID set ·{' '}
                <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={() => setEditingId(true)}>
                  change
                </button>
              </p>
            )
          ))}

          {phase.kind === 'idle' && clientId && !editingId && (
            <ul className="list-disc space-y-1 pl-5 text-ink-soft">
              <li>Google will ask you to sign in and allow access. The site can only see files it saves itself — not the rest of your Drive.</li>
              <li>Photos already in the folder are skipped, so you can run it again after the shower to add new ones.</li>
              <li>
                <strong className="font-medium text-ink">Keep this page open</strong> until it finishes.
              </li>
            </ul>
          )}

          {running && (
            <div>
              <p className="flex items-center gap-2 font-medium text-ink">
                <TriangleAlert aria-hidden="true" className="size-4 text-gold" /> Keep this page open until it finishes.
              </p>
              {phase.step && <p className="mt-2 text-ink-soft">{phase.step}</p>}
              {bar(phase.p)}
            </div>
          )}

          {phase.kind === 'done' && (
            <div role="status" data-drive-done>
              <p className="flex items-center gap-2 font-medium text-ink">
                <CheckCircle2 aria-hidden="true" className="size-4 text-sage" />
                {phase.p.uploaded ? `Saved ${phase.p.uploaded} ${noun} to Google Drive.` : `Everything was already in Google Drive.`}
              </p>
              {bar(phase.p)}
              {phase.p.failed > 0 && <p className="mt-2 text-rose">{phase.p.failed} couldn’t be saved — run it again to retry them.</p>}
              <a href={driveFolderUrl(phase.folderId)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-ink underline underline-offset-4">
                Open the folder in Google Drive <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            </div>
          )}

          {phase.kind === 'stopped' && (
            <div role="alert" data-drive-stopped>
              <p className="text-ink">{phase.message}</p>
              {phase.p && bar(phase.p)}
              {phase.folderId && (
                <a href={driveFolderUrl(phase.folderId)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-ink underline underline-offset-4">
                  Open the folder in Google Drive <ExternalLink aria-hidden="true" className="size-3.5" />
                </a>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
