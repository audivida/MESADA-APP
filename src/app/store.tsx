import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { repo } from '../data'
import { AppError, type Session, type Snapshot } from '../data/repo'

interface Toast {
  id: number
  text: string
  tone: 'ok' | 'error'
}

interface Store {
  session: Session | null
  data: Snapshot | null
  booting: boolean
  setSession(s: Session | null): void
  refresh(): Promise<void>
  /** Roda uma ação, mostra erro amigável e recarrega os dados. Devolve true se deu certo. */
  run(action: () => Promise<unknown>, success?: string): Promise<boolean>
  toasts: Toast[]
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null)
  const [data, setData] = useState<Snapshot | null>(null)
  const [booting, setBooting] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const toast = useCallback((text: string, tone: Toast['tone']) => {
    const id = nextId.current++
    setToasts((t) => [...t.slice(-1), { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 5000 : 2600)
  }, [])

  const load = useCallback(async (s: Session | null) => {
    if (!s?.familyId) {
      setData(null)
      return
    }
    try {
      setData(await repo.load())
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não consegui carregar os dados.', 'error')
    }
  }, [toast])

  const setSession = useCallback(
    (s: Session | null) => {
      setSessionState(s)
      void load(s)
    },
    [load],
  )

  useEffect(() => {
    repo
      .getSession()
      .then(async (s) => {
        setSessionState(s)
        await load(s)
      })
      .finally(() => setBooting(false))
  }, [load])

  // Ao voltar para o app, busca novidades (ex.: tarefa aprovada no celular do pai).
  useEffect(() => {
    const onFocus = () => document.visibilityState === 'visible' && void load(session)
    document.addEventListener('visibilitychange', onFocus)
    return () => document.removeEventListener('visibilitychange', onFocus)
  }, [load, session])

  const refresh = useCallback(() => load(session), [load, session])

  const run = useCallback(
    async (action: () => Promise<unknown>, success?: string) => {
      try {
        await action()
        await load(session)
        if (success) toast(success, 'ok')
        return true
      } catch (e) {
        toast(e instanceof AppError || e instanceof Error ? e.message : 'Algo deu errado. Tente de novo.', 'error')
        return false
      }
    },
    [load, session, toast],
  )

  const value = useMemo(
    () => ({ session, data, booting, setSession, refresh, run, toasts }),
    [session, data, booting, setSession, refresh, run, toasts],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fora do StoreProvider')
  return s
}
