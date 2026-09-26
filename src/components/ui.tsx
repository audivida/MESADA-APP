import { useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { formatMoney, levelFor } from '../domain/rules'
import { useStore } from '../app/store'

type Variant = 'primary' | 'ghost' | 'danger' | 'coin'

export function Button({ variant = 'primary', busy, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button className={`btn btn-${variant} ${className}`} disabled={busy || rest.disabled} {...rest}>
      {busy ? 'Aguarde…' : children}
    </button>
  )
}

export function Field({ label, hint, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId()
  return (
    <label className="field" htmlFor={rest.id ?? id}>
      <span className="field-label">{label}</span>
      <input id={rest.id ?? id} {...rest} />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function LevelBadge({ earned }: { earned: number }) {
  const { level } = levelFor(earned)
  return (
    <span className="level" style={{ ['--lvl' as string]: level.color }}>
      <span className="level-dot" />
      {level.name}
    </span>
  )
}

export function LevelProgress({ earned }: { earned: number }) {
  const { level, next, progress } = levelFor(earned)
  return (
    <div className="lvl-progress">
      <div className="bar">
        <div className="bar-fill" style={{ width: `${progress * 100}%`, background: level.color }} />
      </div>
      <span className="muted small">
        {next ? `Faltam ${next.min - earned} pontos para ${next.name}` : 'Nível máximo! 💎'}
      </span>
    </div>
  )
}

export function Points({ value, pointValueCents }: { value: number; pointValueCents: number }) {
  return (
    <span className="points">
      <b>{value}</b> pts <span className="muted">· {formatMoney(value * pointValueCents)}</span>
    </span>
  )
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden>
        {icon}
      </div>
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
    </div>
  )
}

export function Toasts() {
  const { toasts } = useStore()
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

export interface Tab<T extends string> {
  id: T
  label: string
  icon: string
  badge?: number
}

export function TabBar<T extends string>({ tabs, current, onChange }: { tabs: Tab<T>[]; current: T; onChange(t: T): void }) {
  return (
    <nav className="tabbar" aria-label="Seções">
      {tabs.map((t) => (
        <button key={t.id} className={`tab ${t.id === current ? 'is-active' : ''}`} onClick={() => onChange(t.id)} aria-current={t.id === current ? 'page' : undefined}>
          <span className="tab-icon" aria-hidden>
            {t.icon}
          </span>
          <span>{t.label}</span>
          {!!t.badge && <span className="badge">{t.badge}</span>}
        </button>
      ))}
    </nav>
  )
}

export function relativeDay(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000)
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'ontem'
  if (diff < 7) return `há ${diff} dias`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
