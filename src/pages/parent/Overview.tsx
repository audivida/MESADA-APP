import { useState } from 'react'
import { useStore } from '../../app/store'
import { Button, Empty, LevelBadge, LevelProgress, Points } from '../../components/ui'
import { balance, taskState, totalEarned } from '../../domain/rules'
import { ChildSheet } from './ChildSheet'

export function Overview({ goApprove, goRewards, goFamily }: { goApprove(): void; goRewards(): void; goFamily(): void }) {
  const { data } = useStore()
  const [openChild, setOpenChild] = useState<string | null>(null)
  if (!data) return null
  const { children, executions, ledger, tasks, family } = data
  const pending = executions.filter((e) => e.status === 'pending')
  const requests = data.redemptions.filter((r) => r.status === 'pending')

  return (
    <div className="stack-lg">
      <h1 className="page-title">Como estão as coisas</h1>

      {pending.length > 0 && (
        <button className="alert" onClick={goApprove}>
          <span className="alert-num">{pending.length}</span>
          <span>{pending.length === 1 ? 'tarefa esperando sua aprovação' : 'tarefas esperando sua aprovação'}</span>
          <span aria-hidden>→</span>
        </button>
      )}

      {requests.length > 0 && (
        <button className="alert" onClick={goRewards}>
          <span className="alert-num">{requests.length}</span>
          <span>{requests.length === 1 ? 'prêmio pedido para entregar' : 'prêmios pedidos para entregar'}</span>
          <span aria-hidden>→</span>
        </button>
      )}

      {children.length === 0 ? (
        <Empty icon="🧒" title="Cadastre seu primeiro filho">
          Depois é só criar tarefas e passar o código da família para ele entrar.
          <br />
          <Button className="mt" onClick={goFamily}>
            Cadastrar filho
          </Button>
        </Empty>
      ) : (
        <div className="kids">
          {children.map((c) => {
            const earned = totalEarned(ledger, c.id)
            const bal = balance(ledger, c.id)
            const today = tasks.map((t) => taskState(t, c.id, executions)).filter(Boolean)
            const done = today.filter((s) => s === 'done').length
            return (
              <button key={c.id} className="kid-card" onClick={() => setOpenChild(c.id)}>
                <div className="kid-head">
                  <span className="avatar">{c.avatar}</span>
                  <div>
                    <h3>{c.name}</h3>
                    <LevelBadge earned={earned} />
                  </div>
                </div>
                <Points value={bal} pointValueCents={family.pointValueCents} />
                <LevelProgress earned={earned} />
                <span className="muted small">
                  Hoje: {done} de {today.length} tarefas feitas
                </span>
              </button>
            )
          })}
        </div>
      )}

      {openChild && <ChildSheet childId={openChild} onClose={() => setOpenChild(null)} />}
    </div>
  )
}
