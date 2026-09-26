import { useEffect, useRef, useState } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Número que "sobe" até o valor novo, como um placar. */
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = from.current
    if (start === value || reduced()) {
      from.current = value
      setShown(value)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(start + (value - start) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{shown}</>
}

// Começa do zero na primeira vez que aparece, para o número "entrar" animado.
export function CountUpFromZero({ value }: { value: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(value))
    return () => cancelAnimationFrame(id)
  }, [value])
  return <CountUp value={v} />
}

export interface Celebration {
  icon: string
  title: string
  subtitle?: string
  big?: boolean
}

/** Dispara a comemoração em tela cheia (confete + mensagem). */
export function celebrate(c: Celebration) {
  window.dispatchEvent(new CustomEvent<Celebration>('mesada:celebrate', { detail: c }))
}

/** Chuva de confete a partir de um ponto da tela (ex.: onde a criança tocou). */
export function burst(x: number, y: number, count = 18) {
  if (reduced()) return
  const colors = ['#F2B632', '#16A36B', '#4FA3D9', '#E86F4E', '#A56BE0', '#FF8FB1']
  const layer = document.createElement('div')
  layer.className = 'burst-layer'
  document.body.appendChild(layer)
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span')
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4
    const dist = 60 + Math.random() * 70
    s.className = 'burst-piece'
    s.style.left = `${x}px`
    s.style.top = `${y}px`
    s.style.background = colors[i % colors.length]
    s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`)
    s.style.setProperty('--dy', `${Math.sin(angle) * dist - 30}px`)
    s.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`)
    layer.appendChild(s)
  }
  setTimeout(() => layer.remove(), 900)
}

export function burstFrom(el: Element | null) {
  if (!el) return
  const r = el.getBoundingClientRect()
  burst(r.left + r.width / 2, r.top + r.height / 2)
}

export function CelebrationLayer() {
  const [c, setC] = useState<Celebration | null>(null)
  useEffect(() => {
    const on = (e: Event) => setC((e as CustomEvent<Celebration>).detail)
    window.addEventListener('mesada:celebrate', on)
    return () => window.removeEventListener('mesada:celebrate', on)
  }, [])
  useEffect(() => {
    if (!c || c.big) return
    const id = setTimeout(() => setC(null), 2200)
    return () => clearTimeout(id)
  }, [c])
  if (!c) return null
  const pieces = Array.from({ length: c.big ? 70 : 36 })
  const colors = ['#F2B632', '#16A36B', '#4FA3D9', '#E86F4E', '#A56BE0', '#FF8FB1']
  return (
    <div className={`celebrate ${c.big ? 'is-big' : ''}`} onClick={() => setC(null)} role="dialog" aria-live="assertive" aria-label={c.title}>
      <div className="confetti" aria-hidden>
        {pieces.map((_, i) => (
          <span
            key={i}
            style={{
              left: `${(i * 37) % 100}%`,
              background: colors[i % colors.length],
              animationDelay: `${(i % 12) * 0.06}s`,
              animationDuration: `${1.6 + (i % 5) * 0.25}s`,
              ['--drift' as string]: `${((i * 53) % 80) - 40}px`,
            }}
          />
        ))}
      </div>
      <div className="celebrate-card">
        <div className="celebrate-icon">{c.icon}</div>
        <h2>{c.title}</h2>
        {c.subtitle && <p>{c.subtitle}</p>}
        {c.big && <button className="btn btn-coin">Uhuu! Continuar</button>}
      </div>
    </div>
  )
}
