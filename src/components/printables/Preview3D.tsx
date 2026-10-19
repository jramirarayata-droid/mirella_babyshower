import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ENV, ENV_FLAT } from '../../utils/printables'

const MM = 96 / 25.4 // CSS px per mm

/** Drag (mouse or finger) to turn the object in 3D. */
function useSpin(initial: { x: number; y: number }) {
  const [rot, setRot] = useState(initial)
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const handlers = {
    onPointerDown: (e: ReactPointerEvent) => {
      ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
      drag.current = { px: e.clientX, py: e.clientY, x: rot.x, y: rot.y }
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const d = drag.current
      if (!d) return
      setRot({ x: Math.max(-60, Math.min(60, d.x - (e.clientY - d.py) * 0.4)), y: d.y + (e.clientX - d.px) * 0.5 })
    },
    onPointerUp: () => {
      drag.current = null
    },
    onPointerCancel: () => {
      drag.current = null
    },
  }
  return { rot, setRot, handlers }
}

function Stage({ children, height, spin, hint }: { children: ReactNode; height: number; spin: ReturnType<typeof useSpin>; hint: string }) {
  return (
    <div
      {...spin.handlers}
      style={{
        position: 'relative',
        height,
        perspective: 1600,
        touchAction: 'none',
        cursor: 'grab',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% 40%, var(--color-paper, #fff) 0%, var(--color-cream, #f3eee6) 75%)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* soft floor shadow */}
      <div style={{ position: 'absolute', left: '50%', bottom: '10%', width: '55%', height: 28, transform: 'translateX(-50%)', background: 'radial-gradient(ellipse, rgba(0,0,0,0.18), transparent 70%)', filter: 'blur(4px)' }} />
      {children}
      <p style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted, #8a847b)' }}>{hint}</p>
    </div>
  )
}

const face = (extra: CSSProperties = {}): CSSProperties => ({
  position: 'absolute',
  inset: 0,
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  overflow: 'hidden',
  ...extra,
})

// ---------------------------------------------------------------- envelope (policy type)

interface EnvelopeProps {
  /** The flat envelope SVG (from envelopeSvg). */
  svg: string
  paper: string
  /** px per mm on screen */
  scale: number
  open: boolean
  spin: ReturnType<typeof useSpin>
}

/**
 * The folded policy envelope, built from pieces of the flat print so the
 * preview matches the paper exactly. Portrait: width W, height L (mm).
 * Each piece maps flat-sheet coordinates (x, y) to the face it ends up on.
 */
function EnvelopeModel({ svg, paper, scale: k, open, spin }: EnvelopeProps) {
  const { W, L, glue: G, bottom: B, flap: F } = ENV
  const xr = B + L
  const flat = (transform: string) => (
    <div style={{ position: 'absolute', left: 0, top: 0, width: ENV_FLAT.w * MM, transformOrigin: '0 0', transform }} dangerouslySetInnerHTML={{ __html: svg }} />
  )
  // A clipped window (ux, vy, w, h in mm on the face) showing the flat print through `transform`.
  const piece = (ux: number, vy: number, w: number, h: number, rot: 90 | -90, tx: number, ty: number, extra: CSSProperties = {}) => (
    <div style={{ position: 'absolute', left: ux * k, top: vy * k, width: w * k, height: h * k, overflow: 'hidden', ...extra }}>
      {flat(`translate(${(tx - ux) * k}px, ${(ty - vy) * k}px) rotate(${rot}deg) scale(${k / MM})`)}
    </div>
  )
  const edge: CSSProperties = { boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.14)' }
  const lift: CSSProperties = { boxShadow: '0 1px 2px rgba(0,0,0,0.12)' }
  // Rounded closing-flap outline (as a polygon), and its mirror for the inside face.
  const flapPts: [number, number][] = [[0, 0], [W, 0], [W - 6, F - 14], [W - 12, F - 6], [W / 2, F], [12, F - 6], [6, F - 14]]
  const flapClip = `polygon(${flapPts.map(([u, v]) => `${(u / W) * 100}% ${(v / F) * 100}%`).join(', ')})`
  const flapClipMirror = `polygon(${flapPts.map(([u, v]) => `${((W - u) / W) * 100}% ${(v / F) * 100}%`).join(', ')})`

  return (
    <div
      style={{
        position: 'relative',
        width: W * k,
        height: L * k,
        transformStyle: 'preserve-3d',
        transform: `rotateX(${spin.rot.x}deg) rotateY(${spin.rot.y}deg)`,
        transition: spin.rot.y % 180 === 0 ? 'transform 0.9s cubic-bezier(0.22,1,0.36,1)' : undefined,
      }}
    >
      {/* front: u = y − G, v = xr − x */}
      <div style={face({ transform: 'translateZ(0.6px)', ...edge })}>{piece(0, 0, W, L, -90, -G, xr)}</div>

      {/* back (seen from behind): the whole back panel — the glue strip and bottom flap are folded inside */}
      <div style={{ ...face({ transform: 'rotateY(180deg) translateZ(0.6px)', overflow: 'visible' }), transformStyle: 'preserve-3d' }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', ...edge }}>
          {piece(0, 0, W, L, -90, -(G + W), xr)}
        </div>
        {/* closing flap, hinged at the top edge: closed = lying on the back, open = standing up */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: W * k,
            height: F * k,
            transformStyle: 'preserve-3d',
            transformOrigin: 'top center',
            transform: `translateZ(0.8px) rotateX(${open ? 180 : 0}deg)`,
            transition: 'transform 0.9s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          {/* (clip-path goes on each face — on the hinge it would flatten the 3D) */}
          <div style={face({ ...lift, clipPath: flapClip })}>{piece(0, 0, W, F, 90, G + W, -xr)}</div>
          <div style={face({ transform: 'rotateY(180deg)', background: paper, boxShadow: 'inset 0 0 14px rgba(0,0,0,0.06)', clipPath: flapClipMirror })} />
        </div>
      </div>
    </div>
  )
}

export function Envelope3D({ svg, paper, width }: { svg: string; paper: string; width: number }) {
  const [open, setOpen] = useState(false)
  const spin = useSpin({ x: -10, y: -20 })
  const k = Math.max(1.2, Math.min(2.6, Math.min((width - 60) / ENV.W, 560 / (ENV.L + ENV.flap))))
  const showBack = () => spin.setRot((r) => ({ x: -10, y: Math.round(r.y / 180) * 180 + 180 }))
  return (
    <div>
      <Stage height={(ENV.L + ENV.flap * 2) * k + 70} spin={spin} hint="Drag to turn it around">
        <EnvelopeModel svg={svg} paper={paper} scale={k} open={open} spin={spin} />
      </Stage>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={showBack} className="min-h-10 rounded-full bg-ink px-5 text-sm font-medium text-ivory shadow-soft transition hover:bg-ink-soft">
          Turn over
        </button>
        <button type="button" onClick={() => setOpen((o) => !o)} className="min-h-10 rounded-full border border-line bg-paper px-5 text-sm text-ink transition hover:bg-cream">
          {open ? 'Close the flap' : 'Open the flap'}
        </button>
        <button type="button" onClick={() => spin.setRot({ x: -10, y: -20 })} className="min-h-10 rounded-full px-4 text-sm text-muted transition hover:bg-cream">
          Reset view
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- invitation card

/** `tint`: coloured paper — the card shows the paper's colour under the print (as on the sheets). */
export function Card3D({ frontHtml, backHtml, widthMm, heightMm, width, tint }: { frontHtml: string; backHtml: string; widthMm: number; heightMm: number; width: number; tint?: string }) {
  const spin = useSpin({ x: -8, y: -24 })
  const k = Math.max(1, Math.min(2.4, Math.min((width - 60) / widthMm, 520 / heightMm)))
  const content = (html: string) => (
    <>
      <div style={{ width: widthMm * MM, transform: `scale(${k / MM})`, transformOrigin: 'top left', background: tint ? '#fff' : undefined }} dangerouslySetInnerHTML={{ __html: html }} />
      {tint && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: tint, mixBlendMode: 'multiply', pointerEvents: 'none' }} />}
    </>
  )
  const turn = () => spin.setRot((r) => ({ x: -6, y: Math.round(r.y / 180) * 180 + 180 }))
  return (
    <div>
      <Stage height={heightMm * k + 100} spin={spin} hint="Drag to turn the card">
        <div
          style={{
            position: 'relative',
            width: widthMm * k,
            height: heightMm * k,
            transformStyle: 'preserve-3d',
            transform: `rotateX(${spin.rot.x}deg) rotateY(${spin.rot.y}deg)`,
            transition: spin.rot.y % 180 === 0 ? 'transform 0.9s cubic-bezier(0.22,1,0.36,1)' : undefined,
          }}
        >
          <div style={face({ boxShadow: '0 1px 2px rgba(0,0,0,0.12)' })}>{content(frontHtml)}</div>
          <div style={face({ transform: 'rotateY(180deg)', boxShadow: '0 1px 2px rgba(0,0,0,0.12)' })}>{content(backHtml)}</div>
        </div>
      </Stage>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={turn} className="min-h-10 rounded-full bg-ink px-5 text-sm font-medium text-ivory shadow-soft transition hover:bg-ink-soft">
          Turn over
        </button>
        <button type="button" onClick={() => spin.setRot({ x: -8, y: -24 })} className="min-h-10 rounded-full px-4 text-sm text-muted transition hover:bg-cream">
          Reset view
        </button>
      </div>
    </div>
  )
}
