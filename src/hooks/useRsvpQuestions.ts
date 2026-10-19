import { useEffect, useState } from 'react'
import { listActiveQuestions } from '../services/questionService'
import type { RsvpQuestion } from '../types/questions'

/** Active custom RSVP questions for the public form. */
export function useRsvpQuestions() {
  const [questions, setQuestions] = useState<RsvpQuestion[]>([])
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    listActiveQuestions()
      .then((q) => active && setQuestions(q))
      .catch(() => active && setError(true))
    return () => {
      active = false
    }
  }, [])
  return { questions, error }
}
