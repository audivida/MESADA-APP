import type { Goal, LedgerEntry } from '../domain/types'
import { formatMoney } from '../domain/rules'
import { relativeDay } from './ui'

const KIND_LABEL: Record<LedgerEntry['kind'], string> = {
  task: 'Tarefa',
  goal: 'Meta',
  bonus: 'Bônus',
  penalty: 'Desconto',
  payout: 'Mesada paga',
  reward: 'Prêmio',
}

export function LedgerList({ entries, pointValueCents, limit = 30 }: { entries: LedgerEntry[]; pointValueCents: number; limit?: number }) {
  const sorted = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
  if (!sorted.length) return <p className="muted small">Nada por aqui ainda.</p>
  return (
    <ul className="ledger">
      {sorted.map((e) => (
        <li key={e.id} className={`ledger-row kind-${e.kind}`}>
          <div>
            <span className="ledger-note">{e.note || KIND_LABEL[e.kind]}</span>
            <span className="muted small">
              {KIND_LABEL[e.kind]} · {relativeDay(e.createdAt)}
            </span>
          </div>
          <div className="ledger-amt">
            <b>
              {e.points > 0 ? '+' : ''}
              {e.points}
            </b>
            <span className="muted small">{formatMoney(Math.abs(e.points) * pointValueCents)}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function GoalCard({ goal, current, actions }: { goal: Goal; current: number; actions?: React.ReactNode }) {
  const pct = Math.max(0, Math.min(1, current / goal.targetPoints))
  return (
    <div className={`goal ${goal.achievedAt ? 'is-done' : ''}`}>
      <div className="goal-head">
        <b>{goal.title}</b>
        <span className="muted small">
          {goal.achievedAt ? 'Conquistada! 🎉' : `${Math.min(current, goal.targetPoints)} / ${goal.targetPoints} pts`}
        </span>
      </div>
      <div className="bar">
        <div className="bar-fill coin" style={{ width: `${(goal.achievedAt ? 1 : pct) * 100}%` }} />
      </div>
      {goal.bonusPoints > 0 && !goal.achievedAt && <span className="muted small">Ao conquistar: +{goal.bonusPoints} pts de bônus</span>}
      {actions}
    </div>
  )
}
