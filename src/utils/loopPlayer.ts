/*
 * A seamless music loop for the big-screen presentations.
 *
 * The song (the part chosen in Admin → Music: start → end) is decoded once
 * with Web Audio and played as overlapping "voices": each new pass starts a
 * little before the previous one ends and the two are crossfaded at equal
 * power, so the loop point is one continuous sound — no dip, no gap. Every
 * pass is scheduled on the audio clock (sample-accurate), well ahead of time,
 * so a busy page or a slow timer can't cause a hiccup.
 *
 * Switching off fades out and then suspends the audio clock; switching on
 * resumes it and fades back in, carrying on exactly where it left off.
 */

export interface LoopOptions {
  url: string
  /** Seconds into the song where the section begins. */
  start: number
  /** Where it ends (null = end of the song). */
  end: number | null
  /** 0–1. */
  volume: number
  /** Fade in when the music first starts (seconds). */
  fadeIn: number
}

/** How long the end of the section overlaps the beginning of the next pass. */
const MAX_CROSSFADE = 2.5
/** Passes are scheduled this far ahead (covers browsers slowing timers). */
const LOOKAHEAD = 75
const CURVE_STEPS = 256

function equalPower(rising: boolean): Float32Array {
  const c = new Float32Array(CURVE_STEPS)
  for (let i = 0; i < CURVE_STEPS; i++) {
    const x = i / (CURVE_STEPS - 1)
    c[i] = rising ? Math.sin((x * Math.PI) / 2) : Math.cos((x * Math.PI) / 2)
  }
  return c
}
const RISE = equalPower(true)
const FALL = equalPower(false)

export class LoopPlayer {
  private opts: LoopOptions
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buffer: AudioBuffer | null = null
  private loading: Promise<boolean> | null = null
  private voices: AudioBufferSourceNode[] = []
  private nextAt = 0
  private started = false
  private on = false
  private pumpTimer: number | undefined
  private suspendTimer: number | undefined
  private dead = false
  /** Passes scheduled so far (for tests and troubleshooting). */
  passes = 0
  /** Seconds each pass overlaps the next. */
  crossfade = 0

  constructor(opts: LoopOptions) {
    this.opts = opts
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    try {
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0
      this.master.connect(this.ctx.destination)
    } catch {
      this.ctx = null
    }
    return this.ctx
  }

  /** Downloads and decodes the song ahead of time. Resolves false if it can't. */
  load(): Promise<boolean> {
    if (this.loading) return this.loading
    this.loading = (async () => {
      const ctx = this.context()
      if (!ctx) return false
      try {
        const res = await fetch(this.opts.url, { mode: 'cors' })
        if (!res.ok) return false
        const data = await res.arrayBuffer()
        this.buffer = await ctx.decodeAudioData(data)
        if (this.started) this.pump()
        return true
      } catch {
        return false
      }
    })()
    return this.loading
  }

  /** Call from a click or key press (the browser only allows sound after one). */
  unlock() {
    const ctx = this.context()
    if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
  }

  get playing() {
    return this.on && this.ctx?.state === 'running' && this.passes > 0
  }

  /** Music on (fade in) or off (fade out, then pause the clock). */
  setOn(on: boolean, fade = 0.9) {
    if (this.dead) return
    this.on = on
    const ctx = this.context()
    if (!ctx || !this.master) return
    window.clearTimeout(this.suspendTimer)
    const g = this.master.gain
    if (on) {
      void ctx.resume().catch(() => undefined)
      const firstTime = !this.started
      this.started = true
      void this.load()
      if (this.buffer) this.pump()
      const t = ctx.currentTime
      g.cancelScheduledValues(t)
      g.setValueAtTime(g.value, t)
      g.linearRampToValueAtTime(this.opts.volume, t + Math.max(0.05, firstTime ? this.opts.fadeIn : fade))
    } else {
      const t = ctx.currentTime
      g.cancelScheduledValues(t)
      g.setValueAtTime(g.value, t)
      g.linearRampToValueAtTime(0, t + Math.max(0.05, fade))
      this.suspendTimer = window.setTimeout(() => {
        if (!this.on && ctx.state === 'running') void ctx.suspend().catch(() => undefined)
      }, fade * 1000 + 120)
    }
  }

  /** Keeps passes scheduled ahead on the audio clock. */
  private pump = () => {
    window.clearTimeout(this.pumpTimer)
    const ctx = this.ctx
    const buf = this.buffer
    if (this.dead || !ctx || !buf || !this.master) return
    const start = Math.min(Math.max(0, this.opts.start), Math.max(0, buf.duration - 1))
    const end = Math.min(this.opts.end ?? buf.duration, buf.duration)
    const len = end - start
    if (len < 1) return
    const xf = Math.min(MAX_CROSSFADE, len / 4)
    this.crossfade = xf
    if (this.passes === 0) this.nextAt = ctx.currentTime + 0.05
    while (this.nextAt < ctx.currentTime + LOOKAHEAD) {
      const at = this.nextAt
      const src = ctx.createBufferSource()
      src.buffer = buf
      const g = ctx.createGain()
      src.connect(g)
      g.connect(this.master)
      // The first pass starts at full level (the master fade-in handles it);
      // every later pass rises while the one before it falls.
      if (this.passes > 0) g.gain.setValueCurveAtTime(RISE, at, xf)
      else g.gain.setValueAtTime(1, at)
      g.gain.setValueCurveAtTime(FALL, at + len - xf, xf)
      src.start(at, start, len)
      src.onended = () => {
        this.voices = this.voices.filter((v) => v !== src)
        g.disconnect()
      }
      this.voices.push(src)
      this.passes++
      this.nextAt = at + len - xf
    }
    this.pumpTimer = window.setTimeout(this.pump, 5000)
  }

  /** Fades out quickly and releases the audio. */
  destroy() {
    if (this.dead) return
    this.dead = true
    window.clearTimeout(this.pumpTimer)
    window.clearTimeout(this.suspendTimer)
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    this.master.gain.cancelScheduledValues(t)
    this.master.gain.setValueAtTime(this.master.gain.value, t)
    this.master.gain.linearRampToValueAtTime(0, t + 0.4)
    window.setTimeout(() => {
      this.voices.forEach((v) => {
        try {
          v.stop()
        } catch {
          /* already stopped */
        }
      })
      void ctx.close().catch(() => undefined)
    }, 500)
  }
}
