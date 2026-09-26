import { useRef, useState } from 'react'
import { repo } from '../../data'
import { useStore } from '../../app/store'
import { compressImage } from '../../app/photo'
import { Empty, LevelBadge, LevelProgress, TabBar, relativeDay, type Tab } from '../../components/ui'
import { GoalCard, LedgerList } from '../../components/Ledger'
import { available, balance, formatMoney, taskState, todayISO, totalEarned } from '../../domain/rules'
import type { Task } from '../../domain/types'

type TabId = 'today' | 'shop' | 'wallet'

export function ChildApp() {
  const { data, session, setSession } = useStore()
  const [tab, setTab] = useState<TabId>('today')
  if (!data || session?.role !== 'child') return <div className="loading">Carregando…</div>
  const me = data.children.find((c) => c.id === session.childId)
  if (!me) return <div className="loading">Não encontrei seu cadastro. Peça para seus pais conferirem.</div>

  const tabs: Tab<TabId>[] = [
    { id: 'today', label: 'Hoje', icon: '⭐' },
    { id: 'shop', label: 'Prêmios', icon: '🎁' },
    { id: 'wallet', label: 'Meu cofre', icon: '🪙' },
  ]

  return (
    <div className="shell kid-theme">
      <header className="topbar">
        <span className="eyebrow">
          {me.avatar} Oi, {me.name}!
        </span>
        <button
          className="link muted small"
          onClick={async () => {
            await repo.signOut()
            setSession(null)
          }}
        >
          Sair
        </button>
      </header>
      <main className="content">
        {tab === 'today' && <Today childId={me.id} />}
        {tab === 'shop' && <Shop childId={me.id} />}
        {tab === 'wallet' && <Wallet childId={me.id} />}
      </main>
      <TabBar<TabId> tabs={tabs} current={tab} onChange={setTab} />
    </div>
  )
}

function Today({ childId }: { childId: string }) {
  const { data } = useStore()
  if (!data) return null
  const items = data.tasks
    .map((t) => ({ t, state: taskState(t, childId, data.executions) }))
    .filter((x): x is { t: Task; state: NonNullable<typeof x.state> } => x.state !== null)
  const order = { todo: 0, rejected: 0, pending: 1, done: 2 }
  items.sort((a, b) => order[a.state] - order[b.state])
  const done = items.filter((i) => i.state === 'done').length
  const bal = balance(data.ledger, childId)

  return (
    <div className="stack-lg">
      <div className="hero-balance">
        <span className="eyebrow">Meu saldo</span>
        <div className="big-num">{bal} pts</div>
        <span>{formatMoney(bal * data.family.pointValueCents)}</span>
      </div>
      <div className="row-between">
        <h1 className="page-title">Tarefas de hoje</h1>
        <span className="muted">
          {done}/{items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <Empty icon="🌈" title="Nada para hoje">
          Aproveite o dia!
        </Empty>
      ) : (
        <ul className="task-list">
          {items.map(({ t, state }) => (
            <TaskItem key={t.id} task={t} state={state} childId={childId} />
          ))}
        </ul>
      )}
    </div>
  )
}

function TaskItem({ task, state, childId }: { task: Task; state: 'todo' | 'pending' | 'done' | 'rejected'; childId: string }) {
  const { data, run } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const lastNote = data?.executions
    .filter((e) => e.taskId === task.id && e.childId === childId && e.parentNote)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

  const send = async (file: File | null) => {
    setBusy(true)
    let photo: Blob | null = null
    const ok = await run(async () => {
      if (file) photo = await compressImage(file)
      await repo.submitExecution(task.id, childId, todayISO(), photo)
    }, 'Enviado! Agora é esperar a aprovação 🙌')
    setBusy(false)
    if (!ok && fileRef.current) fileRef.current.value = ''
  }

  return (
    <li className={`kid-task state-${state}`}>
      <div className="kid-task-main">
        <span className="kid-task-check" aria-hidden>
          {state === 'done' ? '✓' : state === 'pending' ? '⏳' : ''}
        </span>
        <div>
          <b>{task.title}</b>
          {task.description && <span className="muted small">{task.description}</span>}
          {state === 'pending' && <span className="small status-text">Esperando aprovação</span>}
          {state === 'rejected' && <span className="small status-text warn">Precisa refazer{lastNote?.parentNote ? `: “${lastNote.parentNote}”` : ''}</span>}
          {state === 'done' && lastNote?.parentNote && <span className="small status-text ok">💬 “{lastNote.parentNote}”</span>}
        </div>
        <span className="pts-chip">+{task.points}</span>
      </div>
      {(state === 'todo' || state === 'rejected') && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void send(f)
            }}
          />
          <button className="btn btn-coin full" disabled={busy} onClick={() => (task.requiresPhoto ? fileRef.current?.click() : void send(null))}>
            {busy ? 'Enviando…' : task.requiresPhoto ? '📷 Tirar foto e enviar' : 'Fiz! Enviar'}
          </button>
        </>
      )}
    </li>
  )
}

function Wallet({ childId }: { childId: string }) {
  const { data } = useStore()
  if (!data) return null
  const bal = balance(data.ledger, childId)
  const earned = totalEarned(data.ledger, childId)
  const goals = data.goals.filter((g) => g.childId === childId)
  const notes = data.executions
    .filter((e) => e.childId === childId && e.parentNote && e.reviewedAt)
    .sort((a, b) => (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? ''))
    .slice(0, 5)

  return (
    <div className="stack-lg">
      <div className="hero-balance">
        <span className="eyebrow">Meu cofre</span>
        <div className="big-num">{formatMoney(bal * data.family.pointValueCents)}</div>
        <span>{bal} pontos</span>
      </div>
      <section className="stack card">
        <div className="row-between">
          <h3>Meu nível</h3>
          <LevelBadge earned={earned} />
        </div>
        <LevelProgress earned={earned} />
        <span className="muted small">Você já ganhou {earned} pontos desde o começo.</span>
      </section>

      <section className="stack">
        <h3>Minhas metas</h3>
        {goals.length === 0 ? <p className="muted small">Converse com seus pais sobre algo que você quer conquistar.</p> : goals.map((g) => <GoalCard key={g.id} goal={g} current={bal} />)}
      </section>

      {notes.length > 0 && (
        <section className="stack">
          <h3>Recados</h3>
          <ul className="notes">
            {notes.map((n) => (
              <li key={n.id}>
                <span>“{n.parentNote}”</span>
                <span className="muted small">
                  {data.tasks.find((t) => t.id === n.taskId)?.title} · {relativeDay(n.reviewedAt!)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="stack">
        <h3>Extrato</h3>
        <LedgerList entries={data.ledger.filter((l) => l.childId === childId)} pointValueCents={data.family.pointValueCents} />
      </section>
    </div>
  )
}

function Shop({ childId }: { childId: string }) {
  const { data, run } = useStore()
  const [busy, setBusy] = useState<string | null>(null)
  if (!data) return null
  const free = available(data.ledger, data.redemptions, childId)
  const rewards = data.rewards.filter((r) => r.active).sort((a, b) => a.costPoints - b.costPoints)
  const mine = data.redemptions
    .filter((r) => r.childId === childId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6)
  const label = { pending: 'Esperando entrega', delivered: 'Entregue', rejected: 'Recusado' }

  return (
    <div className="stack-lg">
      <div className="hero-balance">
        <span className="eyebrow">Posso gastar</span>
        <div className="big-num">{free} pts</div>
        <span>Troque seus pontos por prêmios que a família combinou.</span>
      </div>

      {rewards.length === 0 ? (
        <Empty icon="🎁" title="Ainda não tem prêmios">
          Peça para seus pais criarem a loja da família.
        </Empty>
      ) : (
        <ul className="shop">
          {rewards.map((r) => {
            const missing = r.costPoints - free
            return (
              <li key={r.id} className={`shop-item ${missing > 0 ? 'is-locked' : ''}`}>
                <span className="shop-icon" aria-hidden>
                  {r.icon}
                </span>
                <b>{r.title}</b>
                <span className="pts-chip">{r.costPoints} pts</span>
                {missing > 0 ? (
                  <>
                    <div className="bar">
                      <div className="bar-fill coin" style={{ width: `${Math.max(0, (free / r.costPoints) * 100)}%` }} />
                    </div>
                    <span className="muted small">Faltam {missing} pontos</span>
                  </>
                ) : (
                  <button
                    className="btn btn-coin full"
                    disabled={busy === r.id}
                    onClick={async () => {
                      setBusy(r.id)
                      await run(() => repo.requestRedemption(r.id, childId), 'Pedido enviado! Seus pais vão entregar 🎉')
                      setBusy(null)
                    }}
                  >
                    {busy === r.id ? 'Enviando…' : 'Quero esse!'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {mine.length > 0 && (
        <section className="stack">
          <h3>Meus pedidos</h3>
          <ul className="ledger">
            {mine.map((p) => {
              const reward = data.rewards.find((r) => r.id === p.rewardId)
              return (
                <li key={p.id} className="ledger-row">
                  <div>
                    <span className="ledger-note">
                      {reward?.icon} {reward?.title}
                    </span>
                    <span className="muted small">
                      {p.costPoints} pts · {relativeDay(p.createdAt)}
                    </span>
                  </div>
                  <span className={`pill ${p.status === 'delivered' ? 'pill-ok' : p.status === 'rejected' ? 'pill-no' : 'pill-wait'}`}>{label[p.status]}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
