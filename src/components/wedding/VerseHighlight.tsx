import { cn } from '../ui/cn'
import { Reveal } from './Reveal'

/** The verse itself, as a framed, highlighted card (also used for the preview in Website Settings). */
export function VerseCard({ text, reference, className }: { text: string; reference: string; className?: string }) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  return (
    <figure className={cn('lux-verse fine-frame rounded-sm bg-cream px-7 py-12 text-center shadow-card sm:px-14 sm:py-16', className)}>
      <blockquote className="mx-auto max-w-2xl space-y-4 font-serif text-[1.45rem] font-light italic leading-[1.55] text-ink sm:text-[1.85rem]">
        {paragraphs.map((p, i) => (
          <p key={i}>
            {p.split('\n').map((line, j, all) => (
              <span key={j}>
                {line}
                {j < all.length - 1 && <br />}
              </span>
            ))}
          </p>
        ))}
      </blockquote>
      {reference.trim() && (
        <figcaption className="mt-8 flex items-center justify-center gap-4 text-[0.72rem] font-medium uppercase tracking-[0.22em] text-gold sm:text-[0.75rem] sm:tracking-[0.34em]">
          <span aria-hidden="true" className="hidden h-px w-8 shrink-0 bg-champagne/60 sm:block" />
          <cite className="text-balance not-italic">{reference.trim()}</cite>
          <span aria-hidden="true" className="hidden h-px w-8 shrink-0 bg-champagne/60 sm:block" />
        </figcaption>
      )}
    </figure>
  )
}

/** Highlighted Bible verse on the home page (Admin → Website Settings → Bible verse). */
export function VerseHighlight({ text, reference }: { text: string; reference: string }) {
  if (!text.trim()) return null
  return (
    <section aria-label={reference.trim() ? `Bible verse, ${reference.trim()}` : 'Bible verse'} className="px-5 pb-24 sm:px-8 sm:pb-32">
      <Reveal className="mx-auto max-w-3xl">
        <VerseCard text={text} reference={reference} />
      </Reveal>
    </section>
  )
}
