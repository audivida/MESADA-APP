import { useState } from 'react'
import { repo } from '../../data'
import { useStore } from '../../app/store'
import { AVATARS } from '../../app/brand'
import { Button, Field } from '../../components/ui'
import { ageFrom, formatMoney } from '../../domain/rules'

export function FamilyPage() {
  const { data, run, setSession } = useStore()
  const [adding, setAdding] = useState(false)
  const [kid, setKid] = useState({ name: '', birthdate: '', avatar: AVATARS[0], pin: '' })
  const [fam, setFam] = useState({ name: data?.family.name ?? '', cents: data?.family.pointValueCents ?? 10 })
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!data) return null

  return (
    <div className="stack-lg">
      <h1 className="page-title">Família</h1>

      <section className="card code-card">
        <span className="eyebrow">Código da família</span>
        <div className="code">{data.family.code}</div>
        <p className="muted small">No celular do seu filho, abra o app, toque em “Sou filho ou filha” e digite este código e o PIN dele.</p>
        <Button
          variant="ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(data.family.code)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            } catch {
              /* sem acesso à área de transferência */
            }
          }}
        >
          {copied ? 'Copiado!' : 'Copiar código'}
        </Button>
      </section>

      <section className="stack">
        <div className="row-between">
          <h3>Filhos</h3>
          {!adding && (
            <button className="link" onClick={() => setAdding(true)}>
              + Adicionar
            </button>
          )}
        </div>
        {adding && (
          <form
            className="stack card inset"
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              const ok = await run(() => repo.addChild({ ...kid, birthdate: kid.birthdate || null }), `${kid.name} entrou na família!`)
              setBusy(false)
              if (ok) {
                setAdding(false)
                setKid({ name: '', birthdate: '', avatar: AVATARS[0], pin: '' })
              }
            }}
          >
            <Field label="Nome" required value={kid.name} onChange={(e) => setKid({ ...kid, name: e.target.value })} />
            <Field label="Data de nascimento" type="date" value={kid.birthdate} onChange={(e) => setKid({ ...kid, birthdate: e.target.value })} hint="Usamos para sugerir tarefas da idade certa." />
            <fieldset className="fieldset">
              <legend className="field-label">Avatar</legend>
              <div className="chip-row">
                {AVATARS.map((a) => (
                  <button type="button" key={a} className={`chip avatar-chip ${kid.avatar === a ? 'is-on' : ''}`} onClick={() => setKid({ ...kid, avatar: a })} aria-label={`Avatar ${a}`}>
                    {a}
                  </button>
                ))}
              </div>
            </fieldset>
            <Field label="PIN de 4 números" inputMode="numeric" pattern="\d{4}" maxLength={4} required value={kid.pin} onChange={(e) => setKid({ ...kid, pin: e.target.value.replace(/\D/g, '') })} hint="É a senha dele para entrar." />
            <div className="chip-row">
              <Button busy={busy}>Adicionar</Button>
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
        <ul className="task-list">
          {data.children.map((c) => {
            const age = ageFrom(c.birthdate)
            return (
              <li key={c.id} className="task-row static">
                <div className="kid-head">
                  <span className="avatar">{c.avatar}</span>
                  <div>
                    <b>{c.name}</b>
                    <span className="muted small">{age != null ? `${age} anos` : 'Idade não informada'}</span>
                  </div>
                </div>
                {confirmRemove === c.id ? (
                  <div className="chip-row">
                    <Button variant="danger" onClick={() => void run(() => repo.removeChild(c.id), `${c.name} foi removido`)}>
                      Apagar tudo
                    </Button>
                    <button className="link" onClick={() => setConfirmRemove(null)}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button className="link danger" onClick={() => setConfirmRemove(c.id)}>
                    Remover
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        {confirmRemove && <p className="muted small">Remover apaga as tarefas enviadas, o extrato e as metas dessa criança. Não dá para desfazer.</p>}
      </section>

      <form
        className="stack card"
        onSubmit={async (e) => {
          e.preventDefault()
          await run(() => repo.updateFamily(fam.name, fam.cents), 'Configurações salvas')
        }}
      >
        <h3>Configurações</h3>
        <Field label="Nome da família" required value={fam.name} onChange={(e) => setFam({ ...fam, name: e.target.value })} />
        <Field
          label="Quanto vale 1 ponto (centavos)"
          type="number"
          min={1}
          max={1000}
          required
          value={fam.cents}
          onChange={(e) => setFam({ ...fam, cents: Math.max(1, Number(e.target.value) || 1) })}
          hint={`100 pontos = ${formatMoney(fam.cents * 100)}`}
        />
        <Button>Salvar</Button>
      </form>

      <Button
        variant="ghost"
        onClick={async () => {
          await repo.signOut()
          setSession(null)
        }}
      >
        Sair da conta
      </Button>
    </div>
  )
}
