import { supabase } from '../lib/supabase'
import type { Json, Tables } from '../types/database'
import type { QuestionAudience, QuestionType, RsvpQuestion, RsvpQuestionInput, ShowIf } from '../types/questions'
import { FRIENDLY_ERRORS, FriendlyError, logError } from '../utils/errors'

export const QUESTION_LIMIT = 30
export const OPTION_LIMIT = 20

const TYPES: QuestionType[] = ['single', 'multiple', 'yes_no', 'short_text', 'long_text', 'number']
const AUDIENCES: QuestionAudience[] = ['all', 'attending', 'declining']

function parseShowIf(value: Json | null): ShowIf | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const id = value.questionId
  const values = value.values
  if (typeof id !== 'string' || !Array.isArray(values)) return null
  return { questionId: id, values: values.filter((v): v is string => typeof v === 'string') }
}

const fromRow = (r: Tables<'rsvp_questions'>): RsvpQuestion => ({
  id: r.id,
  question: r.question,
  helpText: r.help_text ?? '',
  type: TYPES.includes(r.type as QuestionType) ? (r.type as QuestionType) : 'short_text',
  options: Array.isArray(r.options) ? r.options.filter((o): o is string => typeof o === 'string') : [],
  maxSelections: r.max_selections,
  minValue: r.min_value,
  maxValue: r.max_value,
  maxLength: r.max_length,
  required: r.required,
  audience: AUDIENCES.includes(r.audience as QuestionAudience) ? (r.audience as QuestionAudience) : 'attending',
  showIf: parseShowIf(r.show_if),
  sortOrder: r.sort_order,
  isActive: r.is_active,
})

function toRow(q: RsvpQuestionInput) {
  const choice = q.type === 'single' || q.type === 'multiple'
  const text = q.type === 'short_text' || q.type === 'long_text'
  return {
    question: q.question.trim(),
    help_text: q.helpText.trim() || null,
    type: q.type,
    options: choice ? q.options.map((o) => o.trim()).filter(Boolean) : [],
    max_selections: q.type === 'multiple' ? q.maxSelections : null,
    min_value: q.type === 'number' ? q.minValue : null,
    max_value: q.type === 'number' ? q.maxValue : null,
    max_length: text ? q.maxLength : null,
    required: q.required,
    audience: q.audience,
    show_if: q.showIf && q.showIf.values.length ? (q.showIf as unknown as Json) : null,
    is_active: q.isActive,
  }
}

async function list(context: string, activeOnly: boolean): Promise<RsvpQuestion[]> {
  let query = supabase.from('rsvp_questions').select('*')
  if (activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query.order('sort_order', { ascending: true }).order('created_at', { ascending: true })
  if (error) {
    logError(context, error)
    throw new FriendlyError(FRIENDLY_ERRORS.generic)
  }
  return ((data ?? []) as Tables<'rsvp_questions'>[]).map(fromRow)
}

export const listActiveQuestions = () => list('listActiveQuestions', true)
export const listAllQuestions = () => list('listAllQuestions', false)

function writeError(context: string, error: { message?: string } | null): never {
  logError(context, error)
  const msg = error?.message ?? ''
  if (msg.includes('QUESTION_LIMIT_REACHED')) throw new FriendlyError(`You can have up to ${QUESTION_LIMIT} custom questions.`)
  if (msg.includes('check constraint')) throw new FriendlyError('Please check the question settings and try again.')
  throw new FriendlyError('The question could not be saved. Please try again.')
}

export async function createQuestion(q: RsvpQuestionInput, sortOrder: number): Promise<RsvpQuestion> {
  const { data, error } = await supabase
    .from('rsvp_questions')
    .insert({ ...toRow(q), sort_order: sortOrder })
    .select('*')
    .single()
  if (error || !data) writeError('createQuestion', error)
  return fromRow(data as Tables<'rsvp_questions'>)
}

export async function updateQuestion(id: string, q: RsvpQuestionInput): Promise<RsvpQuestion> {
  const { data, error } = await supabase.from('rsvp_questions').update(toRow(q)).eq('id', id).select('*').single()
  if (error || !data) writeError('updateQuestion', error)
  return fromRow(data as Tables<'rsvp_questions'>)
}

export async function setQuestionActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('rsvp_questions').update({ is_active: isActive }).eq('id', id)
  if (error) writeError('setQuestionActive', error)
}

export async function reorderQuestions(ids: string[]): Promise<void> {
  const results = await Promise.all(ids.map((id, i) => supabase.from('rsvp_questions').update({ sort_order: i + 1 }).eq('id', id)))
  const failed = results.find((r) => r.error)
  if (failed) {
    logError('reorderQuestions', failed.error)
    throw new FriendlyError('The new order could not be saved. Please try again.')
  }
}

/** Deletes a question. Questions that depended on it are shown to everyone again. */
export async function deleteQuestion(id: string, dependents: RsvpQuestion[]): Promise<void> {
  for (const d of dependents) {
    const { error } = await supabase.from('rsvp_questions').update({ show_if: null }).eq('id', d.id)
    if (error) writeError('deleteQuestion:dependents', error)
  }
  const { error } = await supabase.from('rsvp_questions').delete().eq('id', id)
  if (error) {
    logError('deleteQuestion', error)
    throw new FriendlyError('The question could not be deleted. Please try again.')
  }
}
