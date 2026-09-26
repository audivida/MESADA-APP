import { useState } from 'react'
import { repo } from '../../data'
import { useStore } from '../../app/store'
import { Button, Field, LevelBadge, LevelProgress, Points, Sheet } from '../../components/ui'
import { GoalCard, LedgerList } from '../../components/Ledger'
import { ageFrom, balance, formatMoney, totalEarned } from '../../domain/rules'

type Action = null | 'bonus' | 'penalty' | 'payout' | 'goal'

const ACTION_TITLE = {
  bonus: 'Dar bônus',
  penalty: 'Descontar pontos',
  payout: 'Registrar mesada paga',
}

export function ChildSheet({ childId, onClose }: { childId: string; onClose(): void }) {
  const { data, run } = useStore()
  const [action, setAction] = useState<Action>(null)
  const [points, setPoints] = useState('')
  const [note, setNote] = useState('')
  const [goal, setGoal] = useState({ title: '', target: '', bonus: '' })
  const [busy, setBusy] = useState(false)
  const child = data?.children.find((c) => c.id === childId)
  if (!data || !child) return null
  const { ledger, goals, family } = data
  const bal = balance(ledger, child.id)
  const earned = totalEarned(ledger, child.id)
  const age = ageFrom(child.birthdate)

  const reset = () => {
    setAction(null)
    setPoints('')
    setNote('')
    setGoal({ title: '', target: '', bonus: '' })
  }

  const go = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true)
    const ok = await run(fn, msg)
    setBusy(false)
    if (ok) reset()
  }

  return (
    <Sheet title={child.name} onClose={onClose}>
      <div className="stack-lg">
        <div className="kid-head">
          <span className="avatar lg">{child.avatar}</span>
          <div className="stack-xs">
            <LevelBadge earned={earned} />
            <Points value={bal} pointValueCents={family.pointValueCents} />
            {age != null && <span className="muted small">{age} anos</span>}
          </div>
        </div>
        <LevelProgress earned={earned} />

        <div className="chip-row">
          <Button variant="ghost" onClick={() => setAction('bonus')}>
            + Bônus
          </Button>
          <Button variant="ghost" onClick={() => setAction('penalty')}>
            − Desconto
          </Button>
          <Button variant="coin" onClick={() => { setAction('payout'); setPoints(String(Math.max(0, bal))) }}>
            Pagar mesada
          </Button>
        </div>

        {action && action !== 'goal' && (
          <form
            className="stack card inset"
            onSubmit={(e) => {
              e.preventDefault()
              const p = Number(points)
              const fallback = action === 'payout' ? `Mesada paga (${formatMoney(p * family.pointValueCents)})` : ''
              void go(() => repo.addLedger(child.id, p, action, note || fallback), action === 'payout' ? 'Pagamento registrado' : 'Pontos lançados')
            }}
          >
            <h3>{ACTION_TITLE[action]}</h3>
            <Field
              label="Pontos"
              type="number"
              min={1}
              required
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              hint={points ? `= ${formatMoney(Number(points) * family.pointValueCents)}` : undefined}
            />
            <Field label={action === 'payout' ? 'Observação (opcional)' : 'Motivo'} required={action !== 'payout'} value={note} onChange={(e) => setNote(e.target.value)} />
            {action === 'payout' && <p className="muted small">O dinheiro você entrega por fora (Pix, dinheiro, cofrinho). Aqui só registramos para o saldo bater.</p>}
            <div className="chip-row">
              <Button busy={busy}>Confirmar</Button>
              <Button type="button" variant="ghost" onClick={reset}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        <section className="stack">
          <div className="row-between">
            <h3>Metas</h3>
            {action !== 'goal' && (
              <button className="link" onClick={() => setAction('goal')}>
                + Nova meta
              </button>
            )}
          </div>
          {action === 'goal' && (
            <form
              className="stack card inset"
              onSubmit={(e) => {
                e.preventDefault()
                void go(() => repo.createGoal(child.id, goal.title, Number(goal.target), Number(goal.bonus) || 0), 'Meta criada')
              }}
            >
              <Field label="O que ele quer conquistar" placeholder="Ex.: bicicleta nova" required value={goal.title} onChange={(e) => setGoal({ ...goal, title: e.target.value })} />
              <Field
                label="Pontos necessários"
                type="number"
                min={1}
                required
                value={goal.target}
                onChange={(e) => setGoal({ ...goal, target: e.target.value })}
                hint={goal.target ? `= ${formatMoney(Number(goal.target) * family.pointValueCents)}` : undefined}
              />
              <Field label="Bônus ao conquistar (pontos)" type="number" min={0} value={goal.bonus} onChange={(e) => setGoal({ ...goal, bonus: e.target.value })} />
              <div className="chip-row">
                <Button busy={busy}>Criar meta</Button>
                <Button type="button" variant="ghost" onClick={reset}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
          {goals
            .filter((g) => g.childId === child.id)
            .map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                current={bal}
                actions={
                  !g.achievedAt && (
                    <div className="chip-row">
                      <Button variant="ghost" onClick={() => void go(() => repo.completeGoal(g.id), 'Meta conquistada! 🎉')}>
                        Marcar como conquistada
                      </Button>
                      <button className="link danger" onClick={() => void go(() => repo.removeGoal(g.id), 'Meta removida')}>
                        Remover
                      </button>
                    </div>
                  )
                }
              />
            ))}
        </section>

        <section className="stack">
          <h3>Extrato</h3>
          <LedgerList entries={ledger.filter((l) => l.childId === child.id)} pointValueCents={family.pointValueCents} />
        </section>
      </div>
    </Sheet>
  )
}
