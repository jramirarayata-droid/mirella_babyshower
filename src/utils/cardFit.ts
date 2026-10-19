import { MIN_CARD_FIT } from './printables'

export interface CardFit {
  /** Text scale to print with (1 = normal, down to MIN_CARD_FIT). */
  fit: number
  /** True when even the smallest scale doesn't fit inside the frame. */
  overflow: boolean
}

/**
 * Measures a printable card in the browser (with the real fonts) and finds
 * the largest text scale at which everything fits inside the frame.
 * `make(fit)` returns the card's HTML at that scale; `host` is an off-screen
 * element used for measuring.
 */
export function measureCardFit(make: (fit: number) => string, host: HTMLElement, minFit = MIN_CARD_FIT): CardFit {
  const tooBig = (fit: number) => {
    host.innerHTML = make(fit)
    const body = host.querySelector<HTMLElement>('[data-card-body]')
    const content = host.querySelector<HTMLElement>('[data-card-content]')
    if (!body || !content) return false
    content.style.flex = 'none' // natural height, without stretching to fill the card
    const tall = content.scrollHeight - body.clientHeight > 0.5
    const wide = content.scrollWidth - body.clientWidth > 0.5
    return tall || wide
  }
  try {
    if (!tooBig(1)) return { fit: 1, overflow: false }
    for (let f = 0.97; f >= minFit - 0.001; f -= 0.03) {
      const fit = Math.round(Math.max(minFit, f) * 100) / 100
      if (!tooBig(fit)) return { fit, overflow: false }
    }
    return { fit: minFit, overflow: true }
  } finally {
    host.innerHTML = ''
  }
}
