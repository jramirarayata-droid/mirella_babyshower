/*
 * Raffle sounds, made in the browser (Web Audio) — no sound files to load.
 * Browsers only allow sound after a tap, so the context starts on the Spin press.
 */

type Ctx = AudioContext

let ctx: Ctx | null = null
let master: GainNode | null = null
const MUTE_KEY = 'wedding-raffle-muted'
const VOLUME_KEY = 'wedding-raffle-volume'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* ignore */
  }
}

let muted = read(MUTE_KEY) === '1'
let volume = Math.min(1, Math.max(0, Number(read(VOLUME_KEY) ?? '0.7') || 0.7))

export const isMuted = () => muted
export const getVolume = () => volume
export function setMuted(v: boolean) {
  muted = v
  write(MUTE_KEY, v ? '1' : '0')
  if (master) master.gain.value = v ? 0 : volume
}
export function setVolume(v: number) {
  volume = Math.min(1, Math.max(0, v))
  write(VOLUME_KEY, String(volume))
  if (master && !muted) master.gain.value = volume
}

/** Call from a tap (the Spin button) so sound is allowed. */
export function unlockSound() {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = muted ? 0 : volume
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -14
      comp.knee.value = 10
      comp.ratio.value = 6
      comp.attack.value = 0.004
      comp.release.value = 0.2
      master.connect(comp)
      comp.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, peak: number, endFreq?: number, dest?: AudioNode) {
  if (!ctx || !master || muted) return
  peak = Math.max(peak, 0.0002) // exponential ramps can't reach 0
  const t0 = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g)
  g.connect(dest ?? master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

let lastTick = 0
/** A short click as a name passes the pointer. */
export function playTick() {
  if (!ctx) return
  const now = performance.now()
  if (now - lastTick < 28) return // very fast spins: don't buzz
  lastTick = now
  tone(1900, 0, 0.035, 'square', 0.08)
}

// ---------------------------------------------------------------- bingo

let noiseBuf: AudioBuffer | null = null
function noise(): AudioBuffer | null {
  if (!ctx) return null
  if (!noiseBuf) {
    const len = Math.floor(ctx.sampleRate * 1.5)
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}

/** One noisy hit (snare or cymbal), `start` seconds from now. */
function hit(start: number, peak: number, dur: number, freq: number, type: BiquadFilterType = 'bandpass', dest?: AudioNode) {
  if (!ctx || !master || muted) return
  peak = Math.max(peak, 0.0002)
  const buf = noise()
  if (!buf) return
  const t0 = ctx.currentTime + start
  const src = ctx.createBufferSource()
  src.buffer = buf
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = 0.7
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(f)
  f.connect(g)
  g.connect(dest ?? master)
  src.start(t0, Math.random() * 0.8, dur + 0.05)
}

// ---------------------------------------------------------------- suspense

/** A layer that can be faded out early (a new spin, or the page closing). */
let bed: { gain: GainNode; stopAt: number } | null = null

function stopBed(fade = 0.25) {
  if (!ctx || !bed) return
  const t = ctx.currentTime
  bed.gain.gain.cancelScheduledValues(t)
  bed.gain.gain.setValueAtTime(bed.gain.gain.value, t)
  bed.gain.gain.linearRampToValueAtTime(0, t + fade)
  bed = null
}

/** Stop any suspense still playing. */
export function stopSuspense() {
  stopBed(0.15)
}

/** Low heartbeat "lub-dub" at `start`. */
function heartbeat(start: number, peak: number, dest: AudioNode) {
  tone(70, start, 0.22, 'sine', peak, 38, dest)
  tone(62, start + 0.17, 0.26, 'sine', peak * 0.75, 34, dest)
}

/**
 * Suspense for `seconds`: a dark drone that slowly opens up, a trembling
 * string line climbing in pitch, and a heartbeat that gets faster and louder —
 * then a hush just before the result.
 */
export function playSuspense(seconds: number) {
  if (!ctx || !master || muted || seconds < 0.8) return
  stopBed(0.05)
  const t0 = ctx.currentTime
  const end = t0 + seconds
  const out = ctx.createGain()
  out.gain.setValueAtTime(0.0001, t0)
  out.gain.exponentialRampToValueAtTime(1, t0 + 0.35)
  out.gain.setValueAtTime(1, end - 0.25)
  out.gain.linearRampToValueAtTime(0, end - 0.02) // a breath of silence before the reveal
  out.connect(master)
  bed = { gain: out, stopAt: end }

  // Drone: two detuned saws + a sub, through a filter that opens up.
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 6
  lp.frequency.setValueAtTime(180, t0)
  lp.frequency.exponentialRampToValueAtTime(1400, end)
  const dg = ctx.createGain()
  dg.gain.setValueAtTime(0.0001, t0)
  dg.gain.exponentialRampToValueAtTime(0.16, t0 + seconds * 0.6)
  dg.gain.linearRampToValueAtTime(0.22, end)
  lp.connect(dg)
  dg.connect(out)
  for (const [f, type] of [
    [55, 'sawtooth'],
    [55.6, 'sawtooth'],
    [27.5, 'sine'],
  ] as const) {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f, t0)
    o.frequency.linearRampToValueAtTime(f * 1.06, end) // creeps up a semitone
    o.connect(lp)
    o.start(t0)
    o.stop(end + 0.1)
  }

  // Tremolo strings climbing an octave.
  const sg = ctx.createGain()
  const trem = ctx.createOscillator()
  const tremDepth = ctx.createGain()
  trem.frequency.setValueAtTime(7, t0)
  trem.frequency.linearRampToValueAtTime(13, end)
  tremDepth.gain.value = 0.05
  trem.connect(tremDepth)
  tremDepth.connect(sg.gain)
  sg.gain.setValueAtTime(0.0001, t0)
  sg.gain.exponentialRampToValueAtTime(0.06, t0 + seconds * 0.5)
  sg.gain.linearRampToValueAtTime(0.11, end)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1100
  bp.Q.value = 0.8
  sg.connect(bp)
  bp.connect(out)
  for (const f of [220, 221.5, 330]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(f, t0)
    o.frequency.exponentialRampToValueAtTime(f * 2, end)
    o.connect(sg)
    o.start(t0)
    o.stop(end + 0.1)
  }
  trem.start(t0)
  trem.stop(end + 0.1)

  // Heartbeat: slow to racing, soft to loud.
  let t = 0.15
  while (t < seconds - 0.45) {
    const p = t / seconds
    heartbeat(t, 0.35 + 0.45 * p, out)
    t += 0.95 - 0.55 * p
  }
  // A rising whoosh over the last stretch.
  whoosh(Math.max(0, seconds - 1.6), Math.min(1.5, seconds), out)
}

/** Filtered noise sweeping up. */
function whoosh(start: number, dur: number, dest: AudioNode, peak = 0.25) {
  if (!ctx) return
  const buf = noise()
  if (!buf) return
  const t0 = ctx.currentTime + start
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = 2
  f.frequency.setValueAtTime(300, t0)
  f.frequency.exponentialRampToValueAtTime(5000, t0 + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + dur * 0.95)
  g.gain.linearRampToValueAtTime(0, t0 + dur)
  src.connect(f)
  f.connect(g)
  g.connect(dest)
  src.start(t0)
  src.stop(t0 + dur + 0.05)
}

/** A quick spin (last one standing, before the finals): just a short riser. */
export function playQuickRiser(seconds: number) {
  if (!ctx || !master || muted) return
  whoosh(0, Math.max(0.4, seconds - 0.1), master, 0.12)
}

// ---------------------------------------------------------------- soundboard

/** The classic air horn: short, short, looong. */
export function playAirHorn(start = 0) {
  if (!ctx || !master || muted) return
  const blasts: [number, number][] = [
    [0, 0.16],
    [0.22, 0.16],
    [0.44, 0.85],
  ]
  for (const [at, dur] of blasts) {
    const t0 = ctx.currentTime + start + at
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02)
    g.gain.setValueAtTime(0.2, t0 + dur - 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    const peq = ctx.createBiquadFilter()
    peq.type = 'peaking'
    peq.frequency.value = 2400
    peq.gain.value = 9
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 5200
    peq.connect(lp)
    lp.connect(g)
    g.connect(master)
    for (const f of [466, 470, 587, 698]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(f * 0.94, t0)
      o.frequency.exponentialRampToValueAtTime(f, t0 + 0.05) // the little scoop at the start
      o.connect(peq)
      o.start(t0)
      o.stop(t0 + dur + 0.05)
    }
  }
}

/** Brassy "ta-DAAA!" */
export function playTaDa(start = 0) {
  if (!ctx || !master || muted) return
  const stab = (at: number, dur: number, freqs: number[], peak: number) => {
    const t0 = ctx!.currentTime + start + at
    const lp = ctx!.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 3
    lp.frequency.setValueAtTime(600, t0)
    lp.frequency.exponentialRampToValueAtTime(4200, t0 + 0.06)
    lp.frequency.exponentialRampToValueAtTime(1800, t0 + dur)
    const g = ctx!.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02)
    g.gain.setValueAtTime(peak, t0 + dur * 0.6)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    lp.connect(g)
    g.connect(master!)
    for (const f of freqs)
      for (const d of [-4, 4]) {
        const o = ctx!.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = f
        o.detune.value = d
        o.connect(lp)
        o.start(t0)
        o.stop(t0 + dur + 0.05)
      }
  }
  stab(0, 0.14, [392, 493.88, 587.33], 0.13)
  stab(0.17, 1.5, [523.25, 659.25, 783.99, 1046.5], 0.13)
}

/** Clapping hands, swelling then thinning out. */
export function playApplause(start = 0, seconds = 3, loud = 1) {
  if (!ctx || !master || muted) return
  let t = 0
  while (t < seconds) {
    const p = t / seconds
    const swell = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8
    hit(start + t, (0.05 + 0.18 * Math.random()) * swell * loud, 0.03 + Math.random() * 0.04, 1100 + Math.random() * 1800)
    t += 0.008 + Math.random() * 0.03
  }
}

/** A crowd cheering: a roar of voices and a few "woo!"s. */
export function playCheer(start = 0, seconds = 3) {
  if (!ctx || !master || muted) return
  const buf = noise()
  if (!buf) return
  const t0 = ctx.currentTime + start
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(1.5, t0 + 0.35)
  g.gain.setValueAtTime(1.5, t0 + seconds * 0.45)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds)
  g.connect(master)
  // Voice-like bands, each wobbling on its own so it sounds like many people.
  for (const [f, q, lvl] of [
    [520, 2, 0.5],
    [1100, 3, 0.45],
    [2400, 4, 0.25],
  ] as const) {
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = f
    bp.Q.value = q
    const amp = ctx.createGain()
    amp.gain.value = lvl
    const lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    lfo.frequency.value = 3 + Math.random() * 4
    depth.gain.value = lvl * 0.5
    lfo.connect(depth)
    depth.connect(amp.gain)
    src.connect(bp)
    bp.connect(amp)
    amp.connect(g)
    src.start(t0, Math.random())
    src.stop(t0 + seconds + 0.1)
    lfo.start(t0)
    lfo.stop(t0 + seconds + 0.1)
  }
  // "Woo!"
  for (let i = 0; i < 4; i++) {
    const at = start + 0.2 + Math.random() * seconds * 0.5
    const f = 900 + Math.random() * 500
    tone(f, at, 0.45, 'sine', 0.05, f * 1.7)
  }
}

/** Party blower: a buzzy "brrrrp!" sliding up. */
export function playPartyHorn(start = 0) {
  if (!ctx || !master || muted) return
  const t0 = ctx.currentTime + start
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(280, t0)
  o.frequency.exponentialRampToValueAtTime(620, t0 + 0.55)
  const vib = ctx.createOscillator()
  const vd = ctx.createGain()
  vib.frequency.value = 28
  vd.gain.value = 18
  vib.connect(vd)
  vd.connect(o.frequency)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 2600
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.13, t0 + 0.03)
  g.gain.setValueAtTime(0.13, t0 + 0.5)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.62)
  o.connect(lp)
  lp.connect(g)
  g.connect(master)
  o.start(t0)
  vib.start(t0)
  o.stop(t0 + 0.7)
  vib.stop(t0 + 0.7)
}

/** Game-show "ding ding ding!" */
export function playDings(start = 0) {
  ;[0, 0.14, 0.28].forEach((at, i) => {
    tone(1568 + i * 200, start + at, 0.5, 'sine', 0.22)
    tone(3136 + i * 400, start + at, 0.25, 'sine', 0.06)
  })
}

/** Sad trombone: "wah wah wah waaaah". */
export function playSadTrombone(start = 0) {
  if (!ctx || !master || muted) return
  const notes: [number, number][] = [
    [293.66, 0.38],
    [277.18, 0.38],
    [261.63, 0.38],
    [246.94, 1.2],
  ]
  let at = start
  notes.forEach(([f, dur], i) => {
    const t0 = ctx!.currentTime + at
    const o = ctx!.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(f * 1.03, t0)
    o.frequency.exponentialRampToValueAtTime(f, t0 + 0.08)
    if (i === notes.length - 1) {
      const vib = ctx!.createOscillator()
      const vd = ctx!.createGain()
      vib.frequency.value = 5.5
      vd.gain.setValueAtTime(0, t0)
      vd.gain.linearRampToValueAtTime(9, t0 + 0.4)
      vib.connect(vd)
      vd.connect(o.frequency)
      vib.start(t0)
      vib.stop(t0 + dur + 0.05)
    }
    // The "wah": a filter opening on each note.
    const lp = ctx!.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 5
    lp.frequency.setValueAtTime(350, t0)
    lp.frequency.exponentialRampToValueAtTime(1300, t0 + 0.18)
    lp.frequency.exponentialRampToValueAtTime(600, t0 + dur)
    const g = ctx!.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.04)
    g.gain.setValueAtTime(0.22, t0 + dur * 0.7)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(lp)
    lp.connect(g)
    g.connect(master!)
    o.start(t0)
    o.stop(t0 + dur + 0.05)
    at += dur + 0.06
  })
}

/** A cartoon "boop-bloop" — quick and cheeky (someone's out, mid-round). */
export function playBoop() {
  tone(660, 0, 0.12, 'square', 0.08, 330)
  tone(330, 0.12, 0.2, 'triangle', 0.18, 140)
}

/** A cork pops. */
function pop(start = 0) {
  hit(start, 0.5, 0.06, 900, 'lowpass')
  tone(1400, start, 0.08, 'sine', 0.2, 300)
}

// ---------------------------------------------------------------- results

/** The winner: air horn, ta-da, cheering crowd, applause and a party horn. */
export function playWinner() {
  stopBed(0.05)
  playAirHorn(0)
  playTaDa(1.35)
  playCheer(1.3, 4.2)
  playApplause(1.45, 4.2, 1)
  playPartyHorn(2.2)
  playPartyHorn(2.9)
}

/** A consolation place: ta-da with applause. */
export function playPlace() {
  stopBed(0.05)
  playDings(0)
  playTaDa(0.45)
  playApplause(0.55, 2.8, 0.8)
}

/** Someone's out. Finals: the sad trombone; otherwise a quick cheeky boop. */
export function playKnockedOut(finals: boolean) {
  stopBed(0.05)
  if (finals) playSadTrombone(0)
  else playBoop()
}

// ---------------------------------------------------------------- bingo

/** Bingo: a snare roll over the suspense bed, swelling for `seconds`, ending on a cymbal and a boom. */
export function playDrumroll(seconds = 3) {
  if (!ctx || !master || muted) return
  playSuspense(seconds + 0.2)
  let t = 0
  let i = 0
  while (t < seconds) {
    const p = t / seconds
    hit(t, 0.06 + 0.32 * p * p, 0.07, 1700 + 600 * Math.random())
    if (i % 6 === 0) tone(95 + 20 * p, t, 0.18, 'sine', 0.12 + 0.2 * p, 60)
    t += (0.085 - 0.05 * p) * (0.85 + Math.random() * 0.3)
    i++
  }
  hit(seconds, 0.45, 1.6, 5500, 'highpass')
  tone(120, seconds, 0.5, 'sine', 0.55, 45)
}

/** The ball pops out: pop, game-show dings, a quick cheer and claps. */
export function playBallOut() {
  stopBed(0.05)
  pop(0)
  playDings(0.08)
  playCheer(0.35, 1.8)
  playApplause(0.4, 1.8, 0.7)
}
