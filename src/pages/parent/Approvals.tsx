import { useState } from 'react'
import { repo } from '../../data'
import { useStore } from '../../app/store'
import { Button, Empty, relativeDay } from '../../components/ui'
import type { Execution, Feat, Praise } from '../../domain/types'
import { burstFrom } from '../../components/motion'
import { useRef } from 'react'

const QUICK_NOTES = ['Mandou bem! 👏', 'Muito caprichado!', 'Obrigada pela ajuda ❤️']

export function Approvals() {
  const { data } = useStore()
  if (!data) return null
  const pending = data.executions.filter((e) => e.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const feats = data.feats.filter((f) => f.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const praises = data.praises.filter((p) => p.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const recent = data.executions
    .filter((e) => e.status !== 'pending' && e.reviewedAt)
    .sort((a, b) => (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? ''))
    .slice(0, 8)

  return (
    <div className="stack-lg">
      <h1 className="page-title">Aprovar</h1>
      {feats.length > 0 && (
        <section className="stack">
          <h3>⭐ Façanhas</h3>
          <p className="muted small">Coisas boas que fizeram sem ninguém pedir. Você escolhe quanto vale.</p>
          {feats.map((f) => (
            <FeatCard key={f.id} feat={f} />
          ))}
        </section>
      )}
      {praises.length > 0 && (
        <section className="stack">
          <h3>💌 Elogios entre irmãos</h3>
          {praises.map((p) => (
            <PraiseCard key={p.id} praise={p} />
          ))}
        </section>
      )}
      {(feats.length > 0 || praises.length > 0) && <h3>📋 Tarefas</h3>}
      {pending.length === 0 ? (
        <Empty icon="🎉" title="Tudo em dia">
          Quando alguém enviar uma tarefa, ela aparece aqui.
        </Empty>
      ) : (
        pending.map((e) => <ReviewCard key={e.id} ex={e} />)
      )}

      {recent.length > 0 && (
        <section className="stack">
          <h3>Avaliadas recentemente</h3>
          <ul className="ledger">
            {recent.map((e) => {
              const task = data.tasks.find((t) => t.id === e.taskId)
              const child = data.children.find((c) => c.id === e.childId)
              return (
                <li key={e.id} className="ledger-row">
                  <div>
                    <span className="ledger-note">
                      {child?.avatar} {task?.title}
                    </span>
                    <span className="muted small">
                      {child?.name} · {relativeDay(e.reviewedAt!)}
                    </span>
                  </div>
                  <span className={`pill ${e.status === 'approved' ? 'pill-ok' : 'pill-no'}`}>{e.status === 'approved' ? 'Aprovada' : 'Recusada'}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function ReviewCard({ ex }: { ex: Execution }) {
  const { data, run } = useStore()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<null | 'yes' | 'no'>(null)
  const yesRef = useRef<HTMLDivElement>(null)
  const task = data!.tasks.find((t) => t.id === ex.taskId)
  const child = data!.children.find((c) => c.id === ex.childId)

  const review = async (approve: boolean) => {
    setBusy(approve ? 'yes' : 'no')
    if (approve) burstFrom(yesRef.current)
    await run(() => repo.reviewExecution(ex.id, approve, note), approve ? `+${task?.points ?? 0} pts para ${child?.name}` : 'Tarefa recusada')
    setBusy(null)
  }

  return (
    <article className="review card">
      {ex.photoUrl ? <img className="review-photo" src={ex.photoUrl} alt={`Foto enviada por ${child?.name}`} /> : <div className="review-nophoto">Sem foto</div>}
      <div className="stack">
        <div className="row-between">
          <div>
            <h3>{task?.title ?? 'Tarefa removida'}</h3>
            <span className="muted small">
              {child?.avatar} {child?.name} · {relativeDay(ex.createdAt)}
            </span>
          </div>
          <span className="pts-chip">+{task?.points ?? 0}</span>
        </div>
        <input className="note-input" placeholder="Deixe um recado (opcional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Recado" />
        <div className="chip-row">
          {QUICK_NOTES.map((q) => (
            <button key={q} type="button" className="chip" onClick={() => setNote(q)}>
              {q}
            </button>
          ))}
        </div>
        <div className="chip-row" ref={yesRef}>
          <Button busy={busy === 'yes'} disabled={!!busy} onClick={() => review(true)}>
            Aprovar
          </Button>
          <Button variant="ghost" busy={busy === 'no'} disabled={!!busy} onClick={() => review(false)}>
            Pedir para refazer
          </Button>
        </div>
      </div>
    </article>
  )
}

const FEAT_POINTS = [5, 10, 20, 50]

function FeatCard({ feat }: { feat: Feat }) {
  const { data, run } = useStore()
  const [points, setPoints] = useState(10)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<null | 'yes' | 'no'>(null)
  const yesRef = useRef<HTMLDivElement>(null)
  const child = data!.children.find((c) => c.id === feat.childId)
  const review = async (approve: boolean) => {
    setBusy(approve ? 'yes' : 'no')
    if (approve) burstFrom(yesRef.current)
    await run(() => repo.reviewFeat(feat.id, approve, points, note), approve ? `Façanha aprovada! +${points} pts para ${child?.name}` : 'Façanha recusada')
    setBusy(null)
  }
  return (
    <article className="review card feat-card">
      {feat.photoUrl && <img className="review-photo" src={feat.photoUrl} alt={`Foto da façanha de ${child?.name}`} />}
      <div className="stack">
        <div>
          <h3>{feat.title}</h3>
          <span className="muted small">
            {child?.avatar} {child?.name} · {relativeDay(feat.createdAt)}
          </span>
        </div>
        <div className="chip-row" role="radiogroup" aria-label="Quantos pontos vale">
          {FEAT_POINTS.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={points === p} className={`chip ${points === p ? 'is-on' : ''}`} onClick={() => setPoints(p)}>
              +{p}
            </button>
          ))}
        </div>
        <input className="note-input" placeholder="Deixe um recado (opcional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Recado" />
        <div className="chip-row" ref={yesRef}>
          <Button busy={busy === 'yes'} disabled={!!busy} onClick={() => review(true)}>
            Aprovar +{points}
          </Button>
          <Button variant="ghost" busy={busy === 'no'} disabled={!!busy} onClick={() => review(false)}>
            Não conta
          </Button>
        </div>
      </div>
    </article>
  )
}

function PraiseCard({ praise }: { praise: Praise }) {
  const { data, run } = useStore()
  const [points, setPoints] = useState(0)
  const [busy, setBusy] = useState<null | 'yes' | 'no'>(null)
  const to = data!.children.find((c) => c.id === praise.childId)
  const from = data!.children.find((c) => c.id === praise.fromChildId)
  const review = async (approve: boolean) => {
    setBusy(approve ? 'yes' : 'no')
    await run(() => repo.reviewPraise(praise.id, approve, points), approve ? `Elogio entregue para ${to?.name}` : 'Elogio guardado')
    setBusy(null)
  }
  return (
    <article className="card stack praise-card">
      <p className="praise-msg">“{praise.message}”</p>
      <span className="muted small">
        {from?.avatar} {praise.fromName} → {to?.avatar} {to?.name} · {relativeDay(praise.createdAt)}
      </span>
      <div className="chip-row" role="radiogroup" aria-label="Pontos junto com o elogio">
        {[0, 5, 10].map((p) => (
          <button key={p} type="button" role="radio" aria-checked={points === p} className={`chip ${points === p ? 'is-on' : ''}`} onClick={() => setPoints(p)}>
            {p === 0 ? 'Só o elogio' : `+${p} pts`}
          </button>
        ))}
      </div>
      <div className="chip-row">
        <Button busy={busy === 'yes'} disabled={!!busy} onClick={() => review(true)}>
          Entregar
        </Button>
        <Button variant="ghost" busy={busy === 'no'} disabled={!!busy} onClick={() => review(false)}>
          Não entregar
        </Button>
      </div>
    </article>
  )
}
