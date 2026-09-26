import { useEffect, useRef, useState } from 'react'
import { TRAIL, currentStation, nextStation, type Station } from '../domain/trail'
import { levelFor } from '../domain/rules'

/** Deslocamento lateral de cada estação, em zigue-zague suave (como uma estrada). */
const OFFSETS = [0, 38, 62, 38, 0, -38, -62, -38]

const ICON: Record<Station['kind'], string> = { start: '🚩', step: '⭐', chest: '🎁', trophy: '🏆' }

export function Trail({ earned, avatar, name }: { earned: number; avatar: string; name?: string }) {
  const current = currentStation(earned)
  const next = nextStation(earned)
  const [open, setOpen] = useState<number | null>(null)
  const currentRef = useRef<HTMLButtonElement>(null)

  // Leva a criança direto para onde ela está na trilha.
  useEffect(() => {
    currentRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [])

  return (
    <div className="trail">
      {TRAIL.map((unit, ui) => {
        const unitDone = earned >= unit.stations.at(-1)!.points
        const unitStarted = earned >= unit.level.min
        return (
          <section key={unit.level.id} className={`unit ${unitStarted ? '' : 'is-locked'}`} style={{ ['--lvl' as string]: unit.level.color }}>
            <header className="unit-banner" style={{ animationDelay: `${ui * 0.08}s` }}>
              <span className="eyebrow">
                Nível {ui + 1} · {unit.level.name}
              </span>
              <h3>{unit.title}</h3>
              <p>{unit.subtitle}</p>
              {unitDone && <span className="unit-done">Completo ✓</span>}
            </header>
            <ol className="stations">
              {unit.stations.map((s, si) => {
                const reached = earned >= s.points
                const isCurrent = s.index === current
                const isNext = next?.index === s.index
                const state = isCurrent ? 'current' : reached ? 'done' : isNext ? 'next' : 'locked'
                const offset = OFFSETS[(s.index + ui) % OFFSETS.length]
                return (
                  <li key={s.index} className="station-row" style={{ ['--x' as string]: `${offset}px`, animationDelay: `${si * 0.05}s` }}>
                    {isCurrent && (
                      <div className="you-are-here" aria-hidden>
                        <span className="you-avatar">{avatar}</span>
                        <span className="you-bubble">{name ? `${name} está aqui` : 'Você está aqui'}</span>
                      </div>
                    )}
                    <button
                      ref={isCurrent ? currentRef : undefined}
                      className={`station kind-${s.kind} state-${state}`}
                      onClick={() => setOpen(open === s.index ? null : s.index)}
                      aria-label={`Estação ${s.index + 1}: ${s.points} pontos, ${reached ? 'alcançada' : 'bloqueada'}`}
                      aria-expanded={open === s.index}
                    >
                      <span className="station-icon">{state === 'locked' ? (s.kind === 'trophy' ? '🏆' : '🔒') : s.kind === 'chest' && reached ? '🎉' : ICON[s.kind]}</span>
                      {state === 'next' && <span className="station-ring" aria-hidden />}
                    </button>
                    {open === s.index && (
                      <div className="station-pop" role="status">
                        <b>
                          {s.kind === 'trophy' ? `Troféu ${s.level.name}` : s.kind === 'chest' ? 'Baú surpresa' : `Estação ${s.index + 1}`}
                        </b>
                        {reached ? (
                          <p>💡 {s.tip}</p>
                        ) : (
                          <p>
                            Faltam <b>{s.points - earned}</b> pontos. Cumpra tarefas para chegar aqui e liberar a dica.
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          </section>
        )
      })}
      <div className="trail-end">👑 Fim da trilha… por enquanto!</div>
    </div>
  )
}

export function TrailSummary({ earned }: { earned: number }) {
  const next = nextStation(earned)
  const { level } = levelFor(earned)
  if (!next) return <p className="muted small">Você completou a trilha inteira! 👑</p>
  const prev = [...TRAIL.flatMap((u) => u.stations)].filter((s) => s.points <= earned).at(-1)
  const base = prev?.points ?? 0
  const pct = Math.max(0, Math.min(1, (earned - base) / (next.points - base)))
  return (
    <div className="trail-summary">
      <div className="bar">
        <div className="bar-fill" style={{ width: `${pct * 100}%`, background: level.color }} />
      </div>
      <span className="muted small">
        Faltam {next.points - earned} pontos para {next.kind === 'trophy' ? `o troféu ${next.level.name}` : next.kind === 'chest' ? 'o baú surpresa' : 'a próxima estação'}
      </span>
    </div>
  )
}
