import { useState } from 'react'
import { repo } from '../data'
import { useStore } from '../app/store'
import { Button, Field } from '../components/ui'
import { formatMoney } from '../domain/rules'

export function Onboarding() {
  const { session, setSession, run } = useStore()
  const [name, setName] = useState(session?.role === 'parent' && session.name ? `Família ${session.name}` : '')
  const [cents, setCents] = useState(10)
  const [busy, setBusy] = useState(false)

  return (
    <main className="welcome kid-theme">
      <form
        className="stack card"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          let s = null as Awaited<ReturnType<typeof repo.createFamily>> | null
          const ok = await run(async () => {
            s = await repo.createFamily(name, cents)
          }, 'Família criada!')
          setBusy(false)
          if (ok) setSession(s)
        }}
      >
        <h2>Vamos montar a sua família</h2>
        <Field label="Nome da família" required value={name} onChange={(e) => setName(e.target.value)} />
        <Field
          label="Quanto vale 1 ponto (em centavos)"
          type="number"
          min={1}
          max={1000}
          required
          value={cents}
          onChange={(e) => setCents(Math.max(1, Number(e.target.value) || 1))}
          hint={`Com esse valor, 100 pontos = ${formatMoney(cents * 100)}. Dá para mudar depois.`}
        />
        <Button busy={busy}>Criar família</Button>
        <button
          type="button"
          className="link muted"
          onClick={async () => {
            await repo.signOut()
            setSession(null)
          }}
        >
          Sair
        </button>
      </form>
    </main>
  )
}
