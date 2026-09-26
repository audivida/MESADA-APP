import { useState } from 'react'
import { repo } from '../../data'
import { useStore } from '../../app/store'
import { Button, Empty, Field, Sheet } from '../../components/ui'
import { AGE_BANDS, bandForAge } from '../../domain/suggestions'
import { ageFrom, WEEKDAYS } from '../../domain/rules'
import type { NewTask, Recurrence, Task } from '../../domain/types'

const RECURRENCE: Record<Recurrence, string> = { daily: 'Todo dia', weekly: 'Dias da semana', once: 'Uma vez só' }

const blank = (): NewTask => ({ title: '', description: '', points: 10, recurrence: 'daily', weekdays: [], childIds: [], requiresPhoto: true })

export function TasksPage() {
  const { data } = useStore()
  const [editing, setEditing] = useState<{ id?: string; task: NewTask } | null>(null)
  const [suggest, setSuggest] = useState(false)
  if (!data) return null
  const active = data.tasks.filter((t) => t.active)
  const names = (t: Task) =>
    t.childIds.length === 0 ? 'Todos' : t.childIds.map((id) => data.children.find((c) => c.id === id)?.name).filter(Boolean).join(', ')

  return (
    <div className="stack-lg">
      <div className="row-between">
        <h1 className="page-title">Tarefas</h1>
        <Button onClick={() => setEditing({ task: blank() })}>+ Nova</Button>
      </div>
      <button className="suggest-cta" onClick={() => setSuggest(true)}>
        💡 Ver sugestões de tarefas por idade
      </button>

      {active.length === 0 ? (
        <Empty icon="📋" title="Nenhuma tarefa ainda">
          Crie a primeira ou comece pelas sugestões.
        </Empty>
      ) : (
        <ul className="task-list">
          {active.map((t) => (
            <li key={t.id}>
              <button className="task-row" onClick={() => setEditing({ id: t.id, task: { ...t } })}>
                <div>
                  <b>{t.title}</b>
                  <span className="muted small">
                    {t.recurrence === 'weekly' ? t.weekdays.map((d) => WEEKDAYS[d]).join(', ') : RECURRENCE[t.recurrence]} · {names(t)}
                    {t.requiresPhoto ? ' · 📷' : ''}
                  </span>
                </div>
                <span className="pts-chip">{t.points}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && <TaskForm initial={editing.task} id={editing.id} onClose={() => setEditing(null)} />}
      {suggest && (
        <Suggestions
          onPick={(task) => {
            setSuggest(false)
            setEditing({ task })
          }}
          onClose={() => setSuggest(false)}
        />
      )}
    </div>
  )
}

function TaskForm({ initial, id, onClose }: { initial: NewTask; id?: string; onClose(): void }) {
  const { data, run } = useStore()
  const [t, setT] = useState<NewTask>(initial)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof NewTask>(k: K, v: NewTask[K]) => setT((x) => ({ ...x, [k]: v }))
  const toggle = (list: number[] | string[], v: number | string) =>
    (list as (number | string)[]).includes(v) ? (list as (number | string)[]).filter((x) => x !== v) : [...list, v]

  return (
    <Sheet title={id ? 'Editar tarefa' : 'Nova tarefa'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          const ok = await run(() => repo.saveTask(t, id), 'Tarefa salva')
          setBusy(false)
          if (ok) onClose()
        }}
      >
        <Field label="O que precisa ser feito" required value={t.title} onChange={(e) => set('title', e.target.value)} />
        <Field label="Detalhes (opcional)" value={t.description} onChange={(e) => set('description', e.target.value)} />
        <Field label="Pontos" type="number" min={1} max={1000} required value={t.points} onChange={(e) => set('points', Number(e.target.value))} />

        <fieldset className="fieldset">
          <legend className="field-label">Quando</legend>
          <div className="chip-row">
            {(Object.keys(RECURRENCE) as Recurrence[]).map((r) => (
              <button type="button" key={r} className={`chip ${t.recurrence === r ? 'is-on' : ''}`} onClick={() => set('recurrence', r)}>
                {RECURRENCE[r]}
              </button>
            ))}
          </div>
          {t.recurrence === 'weekly' && (
            <div className="chip-row">
              {WEEKDAYS.map((d, i) => (
                <button type="button" key={d} className={`chip ${t.weekdays.includes(i) ? 'is-on' : ''}`} onClick={() => set('weekdays', toggle(t.weekdays, i) as number[])}>
                  {d}
                </button>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="fieldset">
          <legend className="field-label">Quem faz</legend>
          <div className="chip-row">
            <button type="button" className={`chip ${t.childIds.length === 0 ? 'is-on' : ''}`} onClick={() => set('childIds', [])}>
              Todos
            </button>
            {data?.children.map((c) => (
              <button type="button" key={c.id} className={`chip ${t.childIds.includes(c.id) ? 'is-on' : ''}`} onClick={() => set('childIds', toggle(t.childIds, c.id) as string[])}>
                {c.avatar} {c.name}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="check">
          <input type="checkbox" checked={t.requiresPhoto} onChange={(e) => set('requiresPhoto', e.target.checked)} />
          <span>Pedir foto como prova</span>
        </label>

        <div className="chip-row">
          <Button busy={busy}>Salvar</Button>
          {id && (
            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                if (await run(() => repo.archiveTask(id), 'Tarefa arquivada')) onClose()
              }}
            >
              Arquivar
            </Button>
          )}
        </div>
      </form>
    </Sheet>
  )
}

function Suggestions({ onPick, onClose }: { onPick(t: NewTask): void; onClose(): void }) {
  const { data } = useStore()
  const ages = (data?.children ?? []).map((c) => ageFrom(c.birthdate))
  const highlighted = new Set(ages.map((a) => bandForAge(a)?.label).filter(Boolean))
  const bands = [...AGE_BANDS].sort((a, b) => Number(highlighted.has(b.label)) - Number(highlighted.has(a.label)))

  return (
    <Sheet title="Sugestões por idade" onClose={onClose}>
      <div className="stack-lg">
        {bands.map((b) => (
          <section key={b.label} className="stack">
            <h3>
              {b.label} {highlighted.has(b.label) && <span className="pill pill-ok">sua família</span>}
            </h3>
            <ul className="task-list">
              {b.tasks.map((s) => (
                <li key={s.title}>
                  <button className="task-row" onClick={() => onPick({ ...blank(), title: s.title, points: s.points, recurrence: s.recurrence, weekdays: s.recurrence === 'weekly' ? [6] : [] })}>
                    <div>
                      <b>{s.title}</b>
                      <span className="muted small">{RECURRENCE[s.recurrence]}</span>
                    </div>
                    <span className="pts-chip">{s.points}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  )
}
