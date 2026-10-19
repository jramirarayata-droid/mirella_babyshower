import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, Eye, EyeOff, GitBranch, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { setCachedWeddingSettings } from '../hooks/useWeddingSettings'
import { getWeddingSettings, updateRsvpConfig } from '../services/settingsService'
import {
  OPTION_LIMIT,
  QUESTION_LIMIT,
  createQuestion,
  deleteQuestion,
  listAllQuestions,
  reorderQuestions,
  setQuestionActive,
  updateQuestion,
} from '../services/questionService'
import {
  AUDIENCES,
  BUILTIN_QUESTIONS,
  QUESTION_TYPES,
  type BuiltinKey,
  type QuestionType,
  type RsvpConfig,
  type RsvpQuestion,
  type RsvpQuestionInput,
} from '../types/questions'
import { toFriendlyMessage } from '../utils/errors'
import { additionalGuestDefaultLabel, guestPrice } from '../utils/questions'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Modal } from '../components/ui/Modal'
import { TextField } from '../components/ui/FormField'
import { Skeleton } from '../components/ui/Skeleton'
import { Badge } from '../components/ui/Badge'
import { cn } from '../components/ui/cn'
import { PageHeader } from '../components/admin/PageHeader'
import { useUnsavedChanges } from '../hooks/unsavedChanges'
import { SaveStatus } from '../components/ui/SaveStatus'

const isChoice = (t: QuestionType) => t === 'single' || t === 'multiple' || t === 'yes_no'
const typeLabel = (t: QuestionType) => QUESTION_TYPES.find((x) => x.value === t)?.label ?? t
const audienceShort = { all: 'Everyone', attending: 'Attending', declining: 'Can’t attend' } as const

/** Values a question can be matched on for "show only if". */
function answerValues(q: RsvpQuestion): { value: string; label: string }[] {
  if (q.type === 'yes_no')
    return [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ]
  return q.options.map((o) => ({ value: o, label: o }))
}

function toInput(q: RsvpQuestion): RsvpQuestionInput {
  return {
    question: q.question,
    helpText: q.helpText,
    type: q.type,
    options: q.options.length ? q.options : ['', ''],
    maxSelections: q.maxSelections,
    minValue: q.minValue,
    maxValue: q.maxValue,
    maxLength: q.maxLength,
    required: q.required,
    audience: q.audience,
    showIf: q.showIf,
    isActive: q.isActive,
  }
}

const EMPTY: RsvpQuestionInput = {
  question: '',
  helpText: '',
  type: 'single',
  options: ['', ''],
  maxSelections: null,
  minValue: null,
  maxValue: null,
  maxLength: null,
  required: false,
  audience: 'attending',
  showIf: null,
  isActive: true,
}

export default function AdminQuestions() {
  const toast = useToast()
  const [questions, setQuestions] = useState<RsvpQuestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string | null; values: RsvpQuestionInput } | null>(null)
  const [toDelete, setToDelete] = useState<RsvpQuestion | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'RSVP Questions · Baby shower admin'
    listAllQuestions()
      .then(setQuestions)
      .catch((e) => setError(toFriendlyMessage(e)))
  }, [])

  const move = async (index: number, dir: -1 | 1) => {
    if (!questions) return
    const target = index + dir
    if (target < 0 || target >= questions.length) return
    const next = [...questions]
    ;[next[index], next[target]] = [next[target], next[index]]
    const previous = questions
    setQuestions(next)
    try {
      await reorderQuestions(next.map((q) => q.id))
    } catch (e) {
      setQuestions(previous)
      toast.error(toFriendlyMessage(e))
    }
  }

  const toggleActive = async (q: RsvpQuestion) => {
    try {
      await setQuestionActive(q.id, !q.isActive)
      setQuestions((list) => list?.map((x) => (x.id === q.id ? { ...x, isActive: !q.isActive } : x)) ?? null)
      toast.success(q.isActive ? 'Question hidden from the RSVP form.' : 'Question is now on the RSVP form.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    }
  }

  const confirmDelete = async () => {
    if (!toDelete || !questions) return
    setBusy(true)
    try {
      const dependents = questions.filter((q) => q.showIf?.questionId === toDelete.id)
      await deleteQuestion(toDelete.id, dependents)
      setQuestions(questions.filter((q) => q.id !== toDelete.id).map((q) => (q.showIf?.questionId === toDelete.id ? { ...q, showIf: null } : q)))
      toast.success('Question deleted.')
      setToDelete(null)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const onSaved = (q: RsvpQuestion, isNew: boolean) => {
    setQuestions((list) => (isNew ? [...(list ?? []), q] : (list ?? []).map((x) => (x.id === q.id ? q : x))))
    setEditing(null)
  }

  const byId = useMemo(() => new Map((questions ?? []).map((q) => [q.id, q])), [questions])

  return (
    <>
      <PageHeader
        title="RSVP Questions"
        description="Choose which questions guests answer, rename them, or add your own."
        actions={
          <Button
            onClick={() => setEditing({ id: null, values: { ...EMPTY, options: ['', ''] } })}
            disabled={!questions || questions.length >= QUESTION_LIMIT}
            icon={<Plus aria-hidden="true" className="size-4" />}
          >
            Add question
          </Button>
        }
      />

      <div className="space-y-8">
        <BuiltinCard />

        <section aria-labelledby="custom-heading" className="rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="custom-heading" className="text-2xl text-ink">
                Your questions
              </h2>
              <p className="mt-1 text-sm text-muted">
                Shown after the standard questions and before the wish for the baby. Up to {QUESTION_LIMIT}.
              </p>
            </div>
            {questions && (
              <span className="text-sm text-muted">
                {questions.length} / {QUESTION_LIMIT}
              </span>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-rose/30 bg-rose/5 px-4 py-3 text-sm text-rose">
              {error}
            </p>
          )}
          {!questions && !error && <Skeleton className="h-40" />}
          {questions && questions.length === 0 && (
            <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center">
              <p className="text-ink-soft">No custom questions yet.</p>
              <p className="mt-1 text-sm text-muted">Ideas: “Will you join the after-party?”, “Song request”, “T-shirt size”.</p>
            </div>
          )}

          {questions && questions.length > 0 && (
            <ol className="space-y-3">
              {questions.map((q, i) => {
                const parent = q.showIf ? byId.get(q.showIf.questionId) : undefined
                const parentIndex = parent ? questions.indexOf(parent) : -1
                const orderProblem = parent && parentIndex > i
                return (
                  <li key={q.id} className={cn('rounded-lg border px-4 py-3.5', q.isActive ? 'border-line bg-ivory/40' : 'border-dashed border-line bg-paper opacity-75')}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">
                          <span className="mr-2 text-muted">{i + 1}.</span>
                          {q.question}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge tone="ink">{typeLabel(q.type)}</Badge>
                          <Badge tone="gray">{audienceShort[q.audience]}</Badge>
                          {q.required && <Badge tone="gold">Required</Badge>}
                          {!q.isActive && <Badge tone="rose">Hidden</Badge>}
                        </div>
                        {q.showIf && (
                          <p className={cn('mt-2 flex items-start gap-1.5 text-sm', orderProblem || !parent ? 'text-rose' : 'text-muted')}>
                            <GitBranch aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                            {parent ? (
                              <span>
                                Only if “{parent.question}” is {q.showIf.values.map((v) => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : v)).join(' or ')}
                                {orderProblem && ' — move this question below that one, or it will never show.'}
                              </span>
                            ) : (
                              <span>The question it depends on was removed — edit to fix.</span>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1">
                        <IconButton label="Move up" onClick={() => void move(i, -1)} disabled={i === 0}>
                          <ArrowUp className="size-4" />
                        </IconButton>
                        <IconButton label="Move down" onClick={() => void move(i, 1)} disabled={i === questions.length - 1}>
                          <ArrowDown className="size-4" />
                        </IconButton>
                        <IconButton label={q.isActive ? 'Hide from form' : 'Show on form'} onClick={() => void toggleActive(q)}>
                          {q.isActive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                        </IconButton>
                        <IconButton
                          label="Edit"
                          onClick={() => {
                            setEditing({ id: q.id, values: toInput(q) })
                          }}
                        >
                          <Pencil className="size-4" />
                        </IconButton>
                        <IconButton label="Delete" danger onClick={() => setToDelete(q)}>
                          <Trash2 className="size-4" />
                        </IconButton>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>

      {editing && questions && (
        <QuestionEditor
          key={editing.id ?? 'new'}
          id={editing.id}
          initial={editing.values}
          questions={questions}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        tone="admin"
        title="Delete this question?"
        message={
          <>
            “{toDelete?.question}” will be removed from the RSVP form. Answers guests already gave stay in their responses.
            {toDelete && questions?.some((q) => q.showIf?.questionId === toDelete.id) && (
              <> Questions that depend on it will be shown to everyone instead.</>
            )}{' '}
            To keep it for later, hide it instead.
          </>
        }
        confirmLabel="Delete"
        destructive
        loading={busy}
        loadingText="Deleting…"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </>
  )
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'flex size-9 items-center justify-center rounded-md text-ink-soft transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-30',
        danger && 'hover:bg-rose/10 hover:text-rose',
      )}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Built-in questions

function BuiltinCard() {
  const toast = useToast()
  const [id, setId] = useState<string | null>(null)
  const [config, setConfig] = useState<RsvpConfig | null>(null)
  const [savedJson, setSavedJson] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getWeddingSettings()
      .then((s) => {
        setId(s.id)
        setConfig(s.rsvpConfig)
        setSavedJson(JSON.stringify(s.rsvpConfig))
      })
      .catch((e) => toast.error(toFriendlyMessage(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dirty = Boolean(config) && JSON.stringify(config) !== savedJson
  useUnsavedChanges(dirty, 'RSVP Questions')
  if (!config || !id) return <Skeleton className="h-72" />

  const get = (k: BuiltinKey) => config.builtins[k] ?? { enabled: true }
  const set = (k: BuiltinKey, patch: Partial<{ enabled: boolean; label: string; required: boolean; price: number }>) =>
    setConfig({ ...config, builtins: { ...config.builtins, [k]: { ...get(k), ...patch } } })

  const save = async () => {
    setSaving(true)
    try {
      // Drop empty labels so defaults apply.
      const clean: RsvpConfig = { builtins: {} }
      for (const b of BUILTIN_QUESTIONS) {
        const c = config.builtins[b.key]
        if (!c) continue
        clean.builtins[b.key] = {
          enabled: b.alwaysOn ? true : c.enabled,
          ...(c.label?.trim() ? { label: c.label.trim() } : {}),
          ...(b.canRequire && c.required === false ? { required: false } : {}),
          ...(b.key === 'additionalGuest' && typeof c.price === 'number' ? { price: c.price } : {}),
        }
      }
      const s = await updateRsvpConfig(id, clean)
      setCachedWeddingSettings(s)
      setConfig(s.rsvpConfig)
      setSavedJson(JSON.stringify(s.rsvpConfig))
      toast.success('Standard questions saved.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="builtin-heading" className="rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
      <h2 id="builtin-heading" className="text-2xl text-ink">
        Standard questions
      </h2>
      <p className="mt-1 text-sm text-muted">
        Turn any of these off or reword them. Attendance and mobile number are always asked.
      </p>

      <ul className="mt-5 divide-y divide-line">
        {BUILTIN_QUESTIONS.map((b) => {
          const c = b.alwaysOn ? { ...get(b.key), enabled: true } : get(b.key)
          return (
            <li key={b.key} className="grid gap-3 py-4 md:grid-cols-[auto_1fr] md:items-start md:gap-5">
              {b.alwaysOn ? (
                <span className="flex items-center gap-3 text-sm font-medium text-ink md:w-28 md:pt-2.5">Always</span>
              ) : (
                <label className="flex cursor-pointer items-center gap-3 md:w-28 md:pt-2">
                  <input type="checkbox" checked={c.enabled} onChange={(e) => set(b.key, { enabled: e.target.checked })} className="size-5 accent-ink" />
                  <span className={cn('text-sm font-medium', c.enabled ? 'text-ink' : 'text-muted')}>{c.enabled ? 'Asked' : 'Off'}</span>
                </label>
              )}
              <div className={cn(!c.enabled && 'opacity-55')}>
                <TextField
                  label={<span className="sr-only">Question wording</span>}
                  hideLabel
                  value={c.label ?? ''}
                  placeholder={b.key === 'additionalGuest' ? additionalGuestDefaultLabel(guestPrice(config)) : b.defaultLabel}
                  onChange={(v) => set(b.key, { label: v })}
                  maxLength={200}
                  disabled={!c.enabled}
                />
                <p className="mt-1.5 text-xs text-muted">{b.description} Leave blank to use the wording shown.</p>
                {b.key === 'additionalGuest' && (
                  <div className="mt-3 max-w-xs">
                    <TextField
                      label="Price per additional guest (₱)"
                      inputMode="numeric"
                      value={guestPrice(config) > 0 ? String(guestPrice(config)) : ''}
                      placeholder="No price"
                      onChange={(v) => {
                        const digits = v.replace(/[^0-9]/g, '')
                        const n = digits === '' ? 0 : Number(digits)
                        if (Number.isFinite(n) && n <= 1_000_000) set('additionalGuest', { price: n })
                      }}
                      maxLength={7}
                      hint="Shown on the RSVP form and in your admin pages. Leave blank for no price."
                    />
                  </div>
                )}
                {b.canRequire && c.enabled && (
                  <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                    <input type="checkbox" checked={c.required !== false} onChange={(e) => set(b.key, { required: e.target.checked })} className="size-4 accent-ink" />
                    Required
                  </label>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-2 flex items-center justify-end gap-3 border-t border-line pt-5">
        <SaveStatus dirty={dirty} saving={saving} />
        <Button onClick={() => void save()} loading={saving} loadingText="Saving…" disabled={!dirty} icon={<Save aria-hidden="true" className="size-4" />}>
          Save standard questions
        </Button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Editor

function QuestionEditor({
  id,
  initial,
  questions,
  onClose,
  onSaved,
}: {
  id: string | null
  initial: RsvpQuestionInput
  questions: RsvpQuestion[]
  onClose: () => void
  onSaved: (q: RsvpQuestion, isNew: boolean) => void
}) {
  const toast = useToast()
  const [v, setV] = useState<RsvpQuestionInput>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<RsvpQuestionInput>) => setV((prev) => ({ ...prev, ...patch }))

  // Only questions that come earlier (and have fixed answers) can be depended on.
  const myIndex = id ? questions.findIndex((q) => q.id === id) : questions.length
  const parents = questions.slice(0, myIndex).filter((q) => isChoice(q.type))
  const parent = v.showIf ? questions.find((q) => q.id === v.showIf?.questionId) : undefined

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (!v.question.trim()) e.question = 'Please write the question.'
    if (v.type === 'single' || v.type === 'multiple') {
      const opts = v.options.map((o) => o.trim()).filter(Boolean)
      if (opts.length < 2) e.options = 'Add at least two options.'
      else if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) e.options = 'Each option must be different.'
    }
    if (v.type === 'multiple' && v.maxSelections !== null && (v.maxSelections < 1 || !Number.isInteger(v.maxSelections))) e.maxSelections = 'Enter a whole number, 1 or more.'
    if (v.type === 'number' && v.minValue !== null && v.maxValue !== null && v.minValue > v.maxValue) e.maxValue = 'Maximum must be more than the minimum.'
    if ((v.type === 'short_text' || v.type === 'long_text') && v.maxLength !== null && (v.maxLength < 1 || v.maxLength > 1000)) e.maxLength = 'Enter 1 to 1000.'
    if (v.showIf && !v.showIf.values.length) e.showIf = 'Pick at least one answer, or choose “Always show”.'
    return e
  }

  const save = async () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      const saved = id ? await updateQuestion(id, v) : await createQuestion(v, (questions.at(-1)?.sortOrder ?? 0) + 1)
      toast.success(id ? 'Question updated.' : 'Question added to the RSVP form.')
      onSaved(saved, !id)
    } catch (err) {
      toast.error(toFriendlyMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const numOrNull = (s: string) => (s.trim() === '' || !Number.isFinite(Number(s)) ? null : Number(s))

  return (
    <Modal
      open
      onClose={onClose}
      tone="admin"
      size="lg"
      title={id ? 'Edit question' : 'Add a question'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving} loadingText="Saving…" icon={<Save aria-hidden="true" className="size-4" />}>
            {id ? 'Save changes' : 'Add question'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <TextField label="Question" value={v.question} onChange={(x) => set({ question: x })} maxLength={200} error={errors.question} placeholder="e.g. Will you join us for the after-party?" />
        <TextField label="Help text (optional)" value={v.helpText} onChange={(x) => set({ helpText: x })} maxLength={300} placeholder="A short note shown under the question" />

        <fieldset>
          <legend className="mb-2 text-[0.95rem] font-medium text-ink-soft">Answer type</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {QUESTION_TYPES.map((t) => (
              <label
                key={t.value}
                className={cn(
                  'cursor-pointer rounded-lg border px-3 py-2.5 text-sm transition has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-gold',
                  v.type === t.value ? 'border-ink bg-ink/[0.03]' : 'border-line hover:border-champagne',
                )}
              >
                <input type="radio" name="q-type" className="sr-only" checked={v.type === t.value} onChange={() => set({ type: t.value, options: v.options.length >= 2 ? v.options : ['', ''] })} />
                <span className="block font-medium text-ink">{t.label}</span>
                <span className="block text-xs text-muted">{t.description}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {(v.type === 'single' || v.type === 'multiple') && (
          <fieldset>
            <legend className="mb-2 text-[0.95rem] font-medium text-ink-soft">Options</legend>
            <div className="space-y-2">
              {v.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <TextField
                    className="flex-1"
                    hideLabel
                    label={`Option ${i + 1}`}
                    value={o}
                    placeholder={`Option ${i + 1}`}
                    maxLength={100}
                    onChange={(x) => set({ options: v.options.map((y, j) => (j === i ? x : y)) })}
                  />
                  <button
                    type="button"
                    aria-label={`Remove option ${i + 1}`}
                    disabled={v.options.length <= 2}
                    onClick={() => set({ options: v.options.filter((_, j) => j !== i) })}
                    className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted hover:bg-cream hover:text-rose disabled:opacity-30"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            {errors.options && (
              <p role="alert" className="mt-2 text-sm text-rose">
                {errors.options}
              </p>
            )}
            {v.options.length < OPTION_LIMIT && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => set({ options: [...v.options, ''] })} icon={<Plus aria-hidden="true" className="size-4" />}>
                Add option
              </Button>
            )}
            {id && questions.some((q) => q.showIf?.questionId === id) && (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                Other questions depend on these answers. If you rename an option, update those questions too.
              </p>
            )}
          </fieldset>
        )}

        {v.type === 'multiple' && (
          <TextField
            label="Maximum choices (optional)"
            type="number"
            min={1}
            className="max-w-xs"
            value={v.maxSelections === null ? '' : String(v.maxSelections)}
            onChange={(x) => set({ maxSelections: numOrNull(x) })}
            error={errors.maxSelections}
            placeholder="No limit"
          />
        )}

        {v.type === 'number' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Minimum (optional)" type="number" value={v.minValue === null ? '' : String(v.minValue)} onChange={(x) => set({ minValue: numOrNull(x) })} />
            <TextField label="Maximum (optional)" type="number" value={v.maxValue === null ? '' : String(v.maxValue)} onChange={(x) => set({ maxValue: numOrNull(x) })} error={errors.maxValue} />
          </div>
        )}

        {(v.type === 'short_text' || v.type === 'long_text') && (
          <TextField
            label="Character limit (optional)"
            type="number"
            min={1}
            max={1000}
            className="max-w-xs"
            value={v.maxLength === null ? '' : String(v.maxLength)}
            onChange={(x) => set({ maxLength: numOrNull(x) })}
            error={errors.maxLength}
            placeholder={v.type === 'short_text' ? '120' : '500'}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[0.95rem] font-medium text-ink-soft">Ask</span>
            <select
              value={v.audience}
              onChange={(e) => set({ audience: e.target.value as RsvpQuestionInput['audience'] })}
              className="min-h-11 w-full rounded-md border border-line bg-paper px-3 text-[0.95rem] text-ink focus:border-champagne focus:outline-none focus:ring-2 focus:ring-gold/40"
            >
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-4 self-end rounded-lg border border-line bg-ivory/60 px-4 py-2.5">
            <span className="text-[0.95rem] font-medium text-ink-soft">Required</span>
            <input type="checkbox" checked={v.required} onChange={(e) => set({ required: e.target.checked })} className="size-5 accent-ink" />
          </label>
        </div>

        <fieldset className="rounded-lg border border-line p-4">
          <legend className="px-1 text-[0.95rem] font-medium text-ink-soft">Show this question</legend>
          {parents.length === 0 && !v.showIf ? (
            <p className="text-sm text-muted">Always shown. To make it depend on an answer, add a choice or Yes / No question above it first.</p>
          ) : (
            <>
              <select
                value={v.showIf?.questionId ?? ''}
                onChange={(e) => set({ showIf: e.target.value ? { questionId: e.target.value, values: [] } : null })}
                className="min-h-11 w-full rounded-md border border-line bg-paper px-3 text-[0.95rem] text-ink focus:border-champagne focus:outline-none focus:ring-2 focus:ring-gold/40"
                aria-label="Depends on"
              >
                <option value="">Always</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    Only if: {p.question}
                  </option>
                ))}
                {v.showIf && !parents.some((p) => p.id === v.showIf?.questionId) && <option value={v.showIf.questionId}>(question removed or moved below)</option>}
              </select>
              {parent && v.showIf && (
                <div className="mt-3">
                  <p className="mb-2 text-sm text-muted">…is answered with:</p>
                  <div className="flex flex-wrap gap-2">
                    {answerValues(parent).map((a) => {
                      const checked = v.showIf!.values.includes(a.value)
                      return (
                        <label
                          key={a.value}
                          className={cn(
                            'cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-gold',
                            checked ? 'border-ink bg-ink text-ivory' : 'border-line text-ink-soft hover:border-champagne',
                          )}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={() =>
                              set({
                                showIf: {
                                  questionId: v.showIf!.questionId,
                                  values: checked ? v.showIf!.values.filter((x) => x !== a.value) : [...v.showIf!.values, a.value],
                                },
                              })
                            }
                          />
                          {a.label}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
              {errors.showIf && (
                <p role="alert" className="mt-2 text-sm text-rose">
                  {errors.showIf}
                </p>
              )}
            </>
          )}
        </fieldset>

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-line bg-ivory/60 px-4 py-3">
          <span>
            <span className="block text-[0.95rem] font-medium text-ink-soft">Show on the RSVP form</span>
            <span className="block text-sm text-muted">Turn off to hide it without deleting.</span>
          </span>
          <input type="checkbox" checked={v.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="size-5 accent-ink" />
        </label>
      </div>
    </Modal>
  )
}
