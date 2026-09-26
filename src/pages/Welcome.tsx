import { useState, type FormEvent } from 'react'
import { localRepo, repo } from '../data'
import { useStore } from '../app/store'
import { Button, Field } from '../components/ui'
import { APP_NAME } from '../app/brand'

type Mode = 'home' | 'parent-in' | 'parent-up' | 'child'

export function Welcome() {
  const { setSession, run } = useStore()
  const [mode, setMode] = useState<Mode>('home')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', code: '', pin: '', consent: false })
  const set = (k: keyof typeof form) => (e: { target: { value: string; checked?: boolean; type?: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const submit = (fn: () => Promise<Parameters<typeof setSession>[0]>) => async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    let s: Parameters<typeof setSession>[0] = null
    const ok = await run(async () => {
      s = await fn()
    })
    setBusy(false)
    if (ok) setSession(s)
  }

  return (
    <main className="welcome kid-theme">
      <div className="welcome-hero">
        <div className="coin-logo" aria-hidden>
          ✓
        </div>
        <h1>{APP_NAME}</h1>
        <p className="lede">Tarefa feita vira ponto. Ponto vira mesada. E a casa fica em paz.</p>
      </div>

      {mode === 'home' && (
        <div className="stack">
          <Button onClick={() => setMode('parent-in')}>Sou responsável</Button>
          <Button variant="coin" onClick={() => setMode('child')}>
            Sou filho ou filha
          </Button>
          {localRepo && (
            <Button
              variant="ghost"
              busy={busy}
              onClick={async () => {
                setBusy(true)
                const s = await localRepo!.startDemo()
                setBusy(false)
                setSession(s)
              }}
            >
              Ver uma demonstração
            </Button>
          )}
          {repo.mode === 'local' && (
            <p className="muted small center">
              Modo local: os dados ficam só neste aparelho. Na demonstração, a família tem o código <b>DEMO42</b> e os PINs das crianças são
              1234 (Lia) e 4321 (Theo).
            </p>
          )}
        </div>
      )}

      {mode === 'parent-in' && (
        <form className="stack card" onSubmit={submit(() => repo.signInParent(form.email, form.password))}>
          <h2>Entrar</h2>
          <Field label="E-mail" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
          <Field label="Senha" type="password" autoComplete="current-password" required value={form.password} onChange={set('password')} />
          <Button busy={busy}>Entrar</Button>
          <button type="button" className="link" onClick={() => setMode('parent-up')}>
            Ainda não tem conta? Criar conta grátis
          </button>
          <button type="button" className="link muted" onClick={() => setMode('home')}>
            Voltar
          </button>
        </form>
      )}

      {mode === 'parent-up' && (
        <form className="stack card" onSubmit={submit(() => repo.signUpParent(form.name, form.email, form.password))}>
          <h2>Criar conta</h2>
          <Field label="Seu nome" autoComplete="name" required value={form.name} onChange={set('name')} />
          <Field label="E-mail" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
          <Field label="Senha" type="password" autoComplete="new-password" minLength={6} required hint="Pelo menos 6 caracteres." value={form.password} onChange={set('password')} />
          <label className="check">
            <input type="checkbox" required checked={form.consent} onChange={set('consent')} />
            <span>Sou maior de 18 anos, responsável pelas crianças que vou cadastrar, e autorizo o uso dos dados delas para o funcionamento do app.</span>
          </label>
          <Button busy={busy}>Criar conta</Button>
          <button type="button" className="link" onClick={() => setMode('parent-in')}>
            Já tenho conta
          </button>
        </form>
      )}

      {mode === 'child' && (
        <form className="stack card" onSubmit={submit(() => repo.signInChild(form.code, form.pin))}>
          <h2>Oi! Vamos entrar</h2>
          <Field label="Código da família" autoCapitalize="characters" autoComplete="off" required maxLength={6} value={form.code} onChange={set('code')} hint="Peça para quem cuida de você." />
          <Field label="Seu PIN" inputMode="numeric" pattern="\d{4}" maxLength={4} type="password" required value={form.pin} onChange={set('pin')} />
          <Button variant="coin" busy={busy}>
            Entrar
          </Button>
          <button type="button" className="link muted" onClick={() => setMode('home')}>
            Voltar
          </button>
        </form>
      )}
    </main>
  )
}
