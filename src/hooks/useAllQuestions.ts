import { useEffect, useState } from 'react'
import { listAllQuestions } from '../services/questionService'
import type { RsvpQuestion } from '../types/questions'

/** Admin: every custom RSVP question (active or not), for showing answers. */
export function useAllQuestions() {
  const [questions, setQuestions] = useState<RsvpQuestion[]>([])
  useEffect(() => {
    let active = true
    listAllQuestions()
      .then((q) => active && setQuestions(q))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])
  return questions
}
