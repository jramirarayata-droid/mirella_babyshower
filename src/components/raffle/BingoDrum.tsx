import { useEffect, useRef } from 'react'
import { colorFor } from '../../utils/bingo'

type Ball = { n: number; x: number; y: number; vx: number; vy: number; out: number }

const R = 0.085 // ball radius, as a share of the drum's radius
const CHUTE = { x: 0, y: 1.08 }

/**
 * A glass lotto drum with the balls still in play. They settle at the bottom;
 * while `mixing` they're blown around; `exiting` is the drawn ball rolling out.
 */
export function BingoDrum({ numbers, mixing, exiting, reduce, label }: { numbers: number[]; mixing: boolean; exiting: number | null; reduce: boolean; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const balls = useRef(new Map<number, Ball>())
  const state = useRef({ mixing, exiting, reduce })
  state.current = { mixing, exiting, reduce }

  // Keep the balls in step with the numbers still in play.
  useEffect(() => {
    const map = balls.current
    const keep = new Set(numbers)
    for (const n of [...map.keys()]) if (!keep.has(n)) map.delete(n)
    for (const n of numbers) {
      if (map.has(n)) continue
      // Drop new balls in from random spots inside the top of the drum.
      const a = Math.random() * Math.PI * 2
      const d = Math.random() * 0.6
      map.set(n, { n, x: Math.cos(a) * d, y: Math.sin(a) * d - 0.2, vx: 0, vy: 0, out: 0 })
    }
  }, [numbers])

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const g = el.getContext('2d')
    if (!g) return
    let raf = 0
    let last = performance.now()
    let size = 0
    let swirl = 0

    const resize = () => {
      const box = el.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      size = box.width
      el.width = Math.round(box.width * dpr)
      el.height = Math.round(box.height * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    const step = (dt: number) => {
      const { mixing: mix, exiting: ex, reduce: still } = state.current
      const list = [...balls.current.values()]
      const blow = mix && !still
      swirl = blow ? Math.min(1, swirl + dt * 1.5) : Math.max(0, swirl - dt * 0.8)
      for (const b of list) {
        if (b.n === ex) {
          // The drawn ball rolls to the chute at the bottom and out.
          b.vx += (CHUTE.x - b.x) * 40 * dt
          b.vy += (CHUTE.y + 0.3 - b.y) * 40 * dt
          b.vx *= 0.9
          b.vy *= 0.9
          b.out = Math.min(1, b.out + dt * 1.6)
        } else {
          b.vy += 2.4 * dt // gravity
          if (swirl > 0) {
            // Air jets from below, plus a gentle swirl around the centre.
            // Short random puffs from the bottom keep the balls tumbling through the whole drum.
            if (b.y > 0.2 && Math.random() < 0.35) b.vy -= (3 + Math.random() * 9) * swirl * dt * 3 * (b.y + 0.3)
            b.vx += (Math.random() - 0.5) * 12 * swirl * dt
            b.vx += -b.y * 1.6 * swirl * dt
            b.vy += b.x * 1.6 * swirl * dt
          }
          const damp = swirl > 0 ? 0.995 : 0.975
          b.vx *= damp
          b.vy *= damp
        }
        b.x += b.vx * dt
        b.y += b.vy * dt
        if (b.n === ex) continue
        // Stay inside the glass.
        const d = Math.hypot(b.x, b.y)
        if (d > 1 - R) {
          const nx = b.x / d
          const ny = b.y / d
          b.x = nx * (1 - R)
          b.y = ny * (1 - R)
          const vn = b.vx * nx + b.vy * ny
          if (vn > 0) {
            const e = swirl > 0 ? 0.85 : 0.35
            b.vx -= (1 + e) * vn * nx
            b.vy -= (1 + e) * vn * ny
          }
        }
      }
      // Balls bump into each other.
      for (let i = 0; i < list.length; i++) {
        const a = list[i]
        if (a.n === ex) continue
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j]
          if (b.n === ex) continue
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.hypot(dx, dy)
          if (dist === 0 || dist >= 2 * R) continue
          const nx = dx / dist
          const ny = dy / dist
          const push = (2 * R - dist) / 2
          a.x -= nx * push
          a.y -= ny * push
          b.x += nx * push
          b.y += ny * push
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
          if (rel < 0) {
            const k = (-(1 + 0.75) * rel) / 2
            a.vx -= k * nx
            a.vy -= k * ny
            b.vx += k * nx
            b.vy += k * ny
          }
        }
      }
    }

    const draw = () => {
      const s = size
      if (!s) return
      const c = s / 2
      const scale = c * 0.86
      const cy = c * 0.94
      g.clearRect(0, 0, s, s)

      // chute
      g.fillStyle = 'rgba(120,110,95,0.18)'
      g.strokeStyle = 'rgba(120,110,95,0.45)'
      g.lineWidth = 1.2
      g.beginPath()
      g.rect(c - scale * 0.16, cy + scale * 0.9, scale * 0.32, scale * 0.24)
      g.fill()
      g.stroke()

      // the back of the glass
      const back = g.createRadialGradient(c - scale * 0.3, cy - scale * 0.35, scale * 0.1, c, cy, scale)
      back.addColorStop(0, 'rgba(255,255,255,0.55)')
      back.addColorStop(1, 'rgba(200,190,170,0.22)')
      g.fillStyle = back
      g.beginPath()
      g.arc(c, cy, scale, 0, Math.PI * 2)
      g.fill()

      for (const b of balls.current.values()) {
        const x = c + b.x * scale
        const y = cy + b.y * scale
        const r = R * scale
        g.globalAlpha = 1 - b.out
        const col = colorFor(b.n)
        const grad = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r)
        grad.addColorStop(0, '#ffffff')
        grad.addColorStop(0.25, col)
        grad.addColorStop(1, shade(col, -0.35))
        g.fillStyle = grad
        g.beginPath()
        g.arc(x, y, r, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = 'rgba(255,255,255,0.92)'
        g.beginPath()
        g.arc(x, y, r * 0.56, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = '#2b2a28'
        g.font = `600 ${Math.max(7, r * 0.72)}px system-ui, sans-serif`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(String(b.n), x, y + r * 0.04)
      }
      g.globalAlpha = 1

      // the glass rim and a soft shine on top
      g.strokeStyle = 'rgba(150,135,110,0.55)'
      g.lineWidth = Math.max(2, scale * 0.025)
      g.beginPath()
      g.arc(c, cy, scale, 0, Math.PI * 2)
      g.stroke()
      g.strokeStyle = 'rgba(255,255,255,0.7)'
      g.lineWidth = Math.max(2, scale * 0.04)
      g.beginPath()
      g.arc(c, cy, scale * 0.88, Math.PI * 1.08, Math.PI * 1.42)
      g.stroke()
    }

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      // a few small steps per frame keep the bumps steady
      for (let k = 0; k < 3; k++) step(dt / 3)
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return <canvas ref={canvas} role="img" aria-label={label} className="block aspect-square w-full" />
}

/** Darker (negative) or lighter (positive) version of a #rrggbb colour. */
function shade(hex: string, amt: number): string {
  const v = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.round(Math.min(255, Math.max(0, amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)))
  const r = f((v >> 16) & 255)
  const gr = f((v >> 8) & 255)
  const b = f(v & 255)
  return `rgb(${r},${gr},${b})`
}
