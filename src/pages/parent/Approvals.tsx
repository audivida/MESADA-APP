import { useState } from 'react'
import { repo } from '../../data'
import { useStore } from '../../app/store'
import { Button, Empty, relativeDay } from '../../components/ui'
import type { Execution } from '../../domain/types'
import { burstFrom } from '../../components/motion'
import { useRef } from 'react'

const QUICK_NOTES = ['Mandou bem! 👏', 'Muito caprichado!', 'Obrigada pela ajuda ❤️']

export function Approvals() {
  const { data } = useStore()
  if (!data) return null
  const pending = data.executions.filter((e) => e.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const recent = data.executions
    .filter((e) => e.status !== 'pending' && e.reviewedAt)
    .sort((a, b) => (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? ''))
    .slice(0, 8)

  return (
    <div className="stack-lg">
      <h1 className="page-title">Aprovar tarefas</h1>
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
