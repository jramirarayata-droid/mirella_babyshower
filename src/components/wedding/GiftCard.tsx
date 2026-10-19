import { Gift } from 'lucide-react'
import type { PublicGift } from '../../types/wedding'
import { cn } from '../ui/cn'

/** The couple's gift QR (InstaPay / GCash / Maya). */
export function GiftCard({ gift, className }: { gift: PublicGift; className?: string }) {
  return (
    <div className={cn('fine-frame paper-texture mx-auto w-full max-w-md rounded-sm px-6 py-10 text-center shadow-card sm:px-10', className)}>
      <Gift aria-hidden="true" className="mx-auto size-7 text-champagne" strokeWidth={1.2} />
      <h2 className="mt-4 text-[2rem] leading-tight text-ink">{gift.title}</h2>
      {gift.message && <p className="mx-auto mt-3 max-w-sm whitespace-pre-line text-[0.95rem] leading-relaxed text-ink-soft">{gift.message}</p>}
      <div className="relative z-10 mx-auto mt-7 w-fit rounded-xl bg-white p-3 shadow-soft ring-1 ring-line">
        <img src={gift.qrImageUrl} alt="QR code for sending a wedding gift" className="block size-56 object-contain sm:size-60" loading="lazy" />
      </div>
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted">Scan with GCash, Maya or your banking app</p>
      <a
        href={gift.qrImageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative z-10 mt-3 inline-block rounded px-2 py-1 text-sm text-gold underline-offset-4 hover:underline"
      >
        Open QR in full size
      </a>
    </div>
  )
}
