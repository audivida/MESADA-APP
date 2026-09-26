import { useState } from 'react'
import { repo } from '../../data'
import { useStore } from '../../app/store'
import { REWARD_ICONS, REWARD_IDEAS } from '../../app/brand'
import { Button, Empty, Field, Sheet, relativeDay } from '../../components/ui'
import { available, formatMoney } from '../../domain/rules'
import type { NewReward, Redemption } from '../../domain/types'

export function RewardsPage() {
  const { data, run } = useStore()
  const [editing, setEditing] = useState<{ id?: string; reward: NewReward } | null>(null)
  if (!data) return null
  const pending = data.redemptions.filter((r) => r.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const rewards = data.rewards.filter((r) => r.active).sort((a, b) => a.costPoints - b.costPoints)
  const ideas = REWARD_IDEAS.filter((i) => !rewards.some((r) => r.title === i.title))

  return (
    <div className="stack-lg">
      <div className="row-between">
        <h1 className="page-title">Prêmios</h1>
        <Button onClick={() => setEditing({ reward: { title: '', icon: '🎁', costPoints: 50 } })}>+ Novo</Button>
      </div>

      {pending.length > 0 && (
        <section className="stack">
          <h3>Pedidos para entregar</h3>
          {pending.map((r) => (
            <RequestCard key={r.id} r={r} />
          ))}
        </section>
      )}

      <section className="stack">
        <h3>Loja da família</h3>
        <p className="muted small">Seus filhos trocam pontos por esses prêmios. Os pontos só saem do saldo quando você confirma a entrega.</p>
        {rewards.length === 0 ? (
          <Empty icon="🎁" title="A loja está vazia">
            Crie um prêmio ou use uma das ideias abaixo.
          </Empty>
        ) : (
          <ul className="task-list">
            {rewards.map((r) => (
              <li key={r.id}>
                <button className="task-row" onClick={() => setEditing({ id: r.id, reward: { title: r.title, icon: r.icon, costPoints: r.costPoints } })}>
                  <div className="kid-head">
                    <span className="avatar">{r.icon}</span>
                    <div>
                      <b>{r.title}</b>
                      <span className="muted small">≈ {formatMoney(r.costPoints * data.family.pointValueCents)}</span>
                    </div>
                  </div>
                  <span className="pts-chip">{r.costPoints}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ideas.length > 0 && (
        <section className="stack">
          <h3>Ideias</h3>
          <div className="chip-row">
            {ideas.map((i) => (
              <button key={i.title} className="chip" onClick={() => void run(() => repo.saveReward(i), 'Prêmio adicionado')}>
                + {i.icon} {i.title} · {i.costPoints}
              </button>
            ))}
          </div>
        </section>
      )}

      {editing && <RewardForm initial={editing.reward} id={editing.id} onClose={() => setEditing(null)} />}
    </div>
  )
}

function RequestCard({ r }: { r: Redemption }) {
  const { data, run } = useStore()
  const [busy, setBusy] = useState<null | 'yes' | 'no'>(null)
  const reward = data!.rewards.find((x) => x.id === r.rewardId)
  const child = data!.children.find((c) => c.id === r.childId)
  const go = async (deliver: boolean) => {
    setBusy(deliver ? 'yes' : 'no')
    await run(() => repo.reviewRedemption(r.id, deliver), deliver ? `Entregue! −${r.costPoints} pts de ${child?.name}` : 'Pedido recusado, pontos liberados')
    setBusy(null)
  }
  return (
    <article className="card stack">
      <div className="row-between">
        <div className="kid-head">
          <span className="avatar">{reward?.icon ?? '🎁'}</span>
          <div>
            <b>{reward?.title ?? 'Prêmio removido'}</b>
            <span className="muted small">
              {child?.avatar} {child?.name} pediu {relativeDay(r.createdAt)}
            </span>
          </div>
        </div>
        <span className="pts-chip">−{r.costPoints}</span>
      </div>
      <div className="chip-row">
        <Button busy={busy === 'yes'} disabled={!!busy} onClick={() => go(true)}>
          Entregar
        </Button>
        <Button variant="ghost" busy={busy === 'no'} disabled={!!busy} onClick={() => go(false)}>
          Recusar
        </Button>
      </div>
    </article>
  )
}

function RewardForm({ initial, id, onClose }: { initial: NewReward; id?: string; onClose(): void }) {
  const { data, run } = useStore()
  const [r, setR] = useState(initial)
  const [busy, setBusy] = useState(false)
  const cents = data?.family.pointValueCents ?? 10
  return (
    <Sheet title={id ? 'Editar prêmio' : 'Novo prêmio'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          const ok = await run(() => repo.saveReward(r, id), 'Prêmio salvo')
          setBusy(false)
          if (ok) onClose()
        }}
      >
        <Field label="Prêmio" placeholder="Ex.: escolher o filme de sábado" required value={r.title} onChange={(e) => setR({ ...r, title: e.target.value })} />
        <fieldset className="fieldset">
          <legend className="field-label">Ícone</legend>
          <div className="chip-row">
            {REWARD_ICONS.map((i) => (
              <button type="button" key={i} className={`chip avatar-chip ${r.icon === i ? 'is-on' : ''}`} onClick={() => setR({ ...r, icon: i })} aria-label={`Ícone ${i}`}>
                {i}
              </button>
            ))}
          </div>
        </fieldset>
        <Field
          label="Custa quantos pontos"
          type="number"
          min={1}
          required
          value={r.costPoints}
          onChange={(e) => setR({ ...r, costPoints: Number(e.target.value) })}
          hint={`Equivale a ${formatMoney(r.costPoints * cents)} de mesada.`}
        />
        {data && data.children.length > 0 && (
          <p className="muted small">
            Saldo livre hoje: {data.children.map((c) => `${c.name} ${available(data.ledger, data.redemptions, c.id)} pts`).join(' · ')}
          </p>
        )}
        <div className="chip-row">
          <Button busy={busy}>Salvar</Button>
          {id && (
            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                if (await run(() => repo.archiveReward(id), 'Prêmio removido da loja')) onClose()
              }}
            >
              Tirar da loja
            </Button>
          )}
        </div>
      </form>
    </Sheet>
  )
}
