import { useState } from 'react'
import { Play } from 'lucide-react'
import { parseVideoUrl } from '../../utils/media'
import { Reveal } from './Reveal'

interface Props {
  title: string
  caption: string
  url: string
  posterUrl: string
  /** Extra sections use their own heading id and small label. */
  headingId?: string
  eyebrow?: string
}

/** Cinematic prenup video. Nothing heavy loads until the guest presses play. */
export function VideoHighlight({ title, caption, url, posterUrl, headingId = 'video-heading', eyebrow = 'A Film' }: Props) {
  const video = parseVideoUrl(url)
  const [playing, setPlaying] = useState(false)
  if (video.kind === 'none') return null

  const poster = posterUrl || (video.kind === 'youtube' ? video.thumbnail : '')

  return (
    <section aria-labelledby={headingId} className="bg-[#1d1b19] px-4 py-24 text-[#F6F1E8] sm:px-8 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal className="section-title text-center">
          <p className="text-[0.72rem] font-medium uppercase tracking-[0.32em] text-champagne-light/80">{eyebrow}</p>
          <h2 id={headingId} className="mt-4 text-4xl text-[#F6F1E8] sm:text-5xl">
            {title}
          </h2>
        </Reveal>

        <Reveal className="mt-12">
          <div className="relative aspect-video overflow-hidden rounded-sm bg-black shadow-lift ring-1 ring-white/10">
            {playing ? (
              video.kind === 'file' ? (
                <video src={video.src} poster={poster || undefined} controls autoPlay playsInline className="size-full bg-black object-contain">
                  Your browser can’t play this video.
                </video>
              ) : (
                <iframe
                  src={video.embedUrl}
                  title={title}
                  className="size-full"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              )
            ) : (
              <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 block size-full" aria-label={`Play ${title}`}>
                {poster ? (
                  <img src={poster} alt="" className="size-full object-cover transition duration-700 group-hover:scale-[1.02]" loading="lazy" />
                ) : (
                  <span className="block size-full bg-gradient-to-br from-[#2e2925] to-[#141211]" />
                )}
                <span className="absolute inset-0 bg-black/25 transition group-hover:bg-black/15" />
                <span className="absolute left-1/2 top-1/2 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/10 backdrop-blur-sm transition duration-300 group-hover:scale-105 group-hover:bg-white/20 sm:size-24">
                  <Play className="ml-1 size-8 fill-white text-white" strokeWidth={1} />
                </span>
              </button>
            )}
          </div>
          {caption && <p className="mx-auto mt-6 max-w-2xl text-center font-serif text-xl italic text-white/80">{caption}</p>}
        </Reveal>
      </div>
    </section>
  )
}
