import { motion, useReducedMotion } from 'framer-motion'
import type { NameIdea } from '../../services/showerService'
import { cn } from '../ui/cn'

const TONE: Record<NameIdea['forGender'], string> = {
  girl: 'border-[#E98AA2]/50 bg-[#F9D3DD]/60 text-[#7A2E43]',
  boy: 'border-[#6E9FD8]/50 bg-[#D4E5F7]/60 text-[#23466F]',
  any: 'border-champagne/60 bg-champagne-light/40 text-ink',
}

/** Name ideas as soft bubbles; the more often a name was suggested, the bigger. `big` = for the big screen. */
export function NameCloud({ ideas, big = false }: { ideas: NameIdea[]; big?: boolean }) {
  const reduce = useReducedMotion()
  if (ideas.length === 0) return <p className={cn('text-center text-muted', big && 'text-2xl')}>No name ideas yet — be the first!</p>
  const most = Math.max(...ideas.map((i) => i.count))
  return (
    <section aria-label="Name ideas from our guests">
      <ul className={cn('flex flex-wrap items-center justify-center', big ? 'gap-5' : 'gap-3')}>
        {ideas.map((idea, i) => {
          const weight = most > 1 ? (idea.count - 1) / (most - 1) : 0
          const size = big ? 2 + weight * 2.4 : 1.2 + weight * 1.1
          return (
            <motion.li
              key={idea.name}
              initial={reduce ? false : { opacity: 0, scale: 0.85, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, delay: Math.min(i, 24) * 0.04 }}
              className={cn('rounded-full border px-5 py-2 text-center shadow-soft', TONE[idea.forGender])}
              title={[idea.by.length ? `Suggested by ${idea.by.join(', ')}` : '', ...idea.notes].filter(Boolean).join(' · ')}
            >
              <span className="font-serif leading-tight" style={{ fontSize: `${size}rem` }}>
                {idea.name}
              </span>
              {idea.count > 1 && <span className={cn('ml-1.5 align-top font-sans text-muted', big ? 'text-lg' : 'text-xs')}>×{idea.count}</span>}
              {!big && idea.by.length > 0 && <span className="block text-[0.7rem] text-muted">{idea.by.slice(0, 3).join(', ')}{idea.by.length > 3 ? '…' : ''}</span>}
            </motion.li>
          )
        })}
      </ul>
    </section>
  )
}
