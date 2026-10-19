/*
 * Plays one part of a song (start → end) with a fade in and a fade out, once
 * or on repeat. Volume goes through Web Audio, because iPhones ignore the
 * <audio> volume setting. Only the part that plays is downloaded (the browser
 * asks for that range of the file), and nothing loads until it starts.
 */

export interface SegmentOptions {
  url: string
  start: number
  /** null = to the end of the song. */
  end: number | null
  fadeIn: number
  fadeOut: number
  loop: boolean
  volume: number
}

export class SegmentPlayer {
  private audio: HTMLAudioElement
  private ctx: AudioContext | null = null
  private gain: GainNode | null = null
  private opts: SegmentOptions
  private fadingOut = false
  private stopTimer: number | undefined
  private wantPlaying = false
  onChange: ((playing: boolean) => void) | null = null

  constructor(opts: SegmentOptions) {
    this.opts = opts
    this.audio = new Audio()
    this.audio.crossOrigin = 'anonymous'
    this.audio.preload = 'none'
    this.audio.src = opts.url
    this.audio.addEventListener('timeupdate', this.tick)
    this.audio.addEventListener('ended', this.atEnd)
    this.audio.addEventListener('pause', () => this.onChange?.(false))
    this.audio.addEventListener('playing', () => this.onChange?.(true))
  }

  /** Where the song is now (seconds). */
  get time() {
    return this.audio.currentTime
  }

  /** Jump to a point and play from there (used to preview the ending). */
  async playFrom(seconds: number) {
    await this.play()
    this.audio.currentTime = Math.max(this.opts.start, seconds)
  }

  get playing() {
    return this.wantPlaying && !this.audio.paused
  }

  update(opts: Partial<SegmentOptions>) {
    const urlChanged = opts.url !== undefined && opts.url !== this.opts.url
    this.opts = { ...this.opts, ...opts }
    if (urlChanged) {
      const was = this.wantPlaying
      this.stop(0)
      this.audio.src = this.opts.url
      if (was) void this.play()
    } else if (this.gain && this.ctx && !this.fadingOut && this.wantPlaying) {
      this.gain.gain.setTargetAtTime(this.opts.volume, this.ctx.currentTime, 0.1)
    }
  }

  private ensureGraph() {
    if (this.ctx) return
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      const src = this.ctx.createMediaElementSource(this.audio)
      this.gain = this.ctx.createGain()
      this.gain.gain.value = 0
      src.connect(this.gain)
      this.gain.connect(this.ctx.destination)
    } catch {
      this.ctx = null
      this.gain = null
    }
  }

  private get endAt() {
    const d = Number.isFinite(this.audio.duration) ? this.audio.duration : Infinity
    return Math.min(this.opts.end ?? d, d)
  }

  private fadeTo(value: number, seconds: number) {
    if (this.gain && this.ctx) {
      const t = this.ctx.currentTime
      this.gain.gain.cancelScheduledValues(t)
      this.gain.gain.setValueAtTime(this.gain.gain.value, t)
      this.gain.gain.linearRampToValueAtTime(value, t + Math.max(0.05, seconds))
    } else {
      this.audio.volume = Math.min(1, Math.max(0, value))
    }
  }

  /** Must be called from a tap or key press the first time (browser rule). */
  async play(fromStart = false) {
    this.wantPlaying = true
    window.clearTimeout(this.stopTimer)
    this.ensureGraph()
    if (this.ctx?.state === 'suspended') await this.ctx.resume().catch(() => undefined)
    // Without a tap the browser keeps sound off: report that instead of playing silently.
    if (this.ctx && this.ctx.state !== 'running') {
      this.wantPlaying = false
      this.onChange?.(false)
      return false
    }
    const t = this.audio.currentTime
    if (fromStart || t < this.opts.start || t >= this.endAt - 0.2) this.audio.currentTime = this.opts.start
    this.fadingOut = false
    if (this.gain) this.gain.gain.value = 0
    try {
      await this.audio.play()
    } catch {
      this.wantPlaying = false
      this.onChange?.(false)
      return false
    }
    this.fadeTo(this.opts.volume, this.opts.fadeIn)
    return true
  }

  /** Fades out, then pauses. */
  stop(fade = 0.6) {
    this.wantPlaying = false
    window.clearTimeout(this.stopTimer)
    if (this.audio.paused) return
    this.fadeTo(0, fade)
    this.stopTimer = window.setTimeout(() => this.audio.pause(), fade * 1000 + 60)
  }

  private tick = () => {
    if (!this.wantPlaying) return
    const left = this.endAt - this.audio.currentTime
    if (!this.fadingOut && left <= Math.max(0.05, this.opts.fadeOut)) {
      this.fadingOut = true
      this.fadeTo(0, Math.max(0.05, left))
    }
    if (left <= 0.05) this.atEnd()
  }

  private atEnd = () => {
    if (!this.wantPlaying) return
    if (this.opts.loop) {
      this.audio.currentTime = this.opts.start
      this.fadingOut = false
      if (this.audio.paused) void this.audio.play().catch(() => undefined)
      this.fadeTo(this.opts.volume, this.opts.fadeIn)
    } else {
      this.wantPlaying = false
      this.audio.pause()
    }
  }

  destroy() {
    this.wantPlaying = false
    window.clearTimeout(this.stopTimer)
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
    void this.ctx?.close().catch(() => undefined)
  }
}

/** 95.4 → "1:35" */
export function mmss(s: number): string {
  const v = Math.max(0, Math.round(s))
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
}

/** "1:35" or "95" → 95. */
export function parseMmss(t: string): number | null {
  const m = /^\s*(\d+)(?::(\d{1,2}))?\s*$/.exec(t)
  if (!m) return null
  return m[2] !== undefined ? Number(m[1]) * 60 + Number(m[2]) : Number(m[1])
}
