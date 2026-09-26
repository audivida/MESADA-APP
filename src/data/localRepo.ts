import type { Child, Execution, Family, Goal, LedgerEntry, NewReward, Redemption, Reward, Task } from '../domain/types'
import { available, todayISO } from '../domain/rules'
import { AppError, type NewChild, type Repo, type Session, type Snapshot } from './repo'

interface LocalParent {
  email: string
  passwordHash: string
  name: string
  familyId: string | null
}

interface LocalDB {
  parents: LocalParent[]
  families: Family[]
  children: (Child & { pin: string })[]
  tasks: Task[]
  executions: Execution[]
  ledger: LedgerEntry[]
  goals: Goal[]
  rewards: Reward[]
  redemptions: Redemption[]
  session: (Session & { email?: string }) | null
}

const KEY = 'minha-mesada:db'

const empty = (): LocalDB => ({
  parents: [],
  families: [],
  children: [],
  tasks: [],
  executions: [],
  ledger: [],
  goals: [],
  rewards: [],
  redemptions: [],
  session: null,
})

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

export function familyCode(): string {
  // Sem letras que confundem (0/O, 1/I).
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

async function hash(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  return text
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export interface Storage {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
}

/** Guarda tudo no navegador. Serve para a demonstração e para testar sem servidor. */
export class LocalRepo implements Repo {
  readonly mode = 'local' as const
  private store: Storage

  constructor(store?: Storage) {
    const fallback = new Map<string, string>()
    this.store = store ?? {
      getItem: (k) => {
        try {
          return localStorage.getItem(k)
        } catch {
          return fallback.get(k) ?? null
        }
      },
      setItem: (k, v) => {
        try {
          localStorage.setItem(k, v)
        } catch {
          fallback.set(k, v)
        }
      },
    }
  }

  private read(): LocalDB {
    const raw = this.store.getItem(KEY)
    if (!raw) return empty()
    try {
      return { ...empty(), ...JSON.parse(raw) }
    } catch {
      return empty()
    }
  }

  private write(db: LocalDB) {
    this.store.setItem(KEY, JSON.stringify(db))
  }

  private mutate<T>(fn: (db: LocalDB) => T): T {
    const db = this.read()
    const out = fn(db)
    this.write(db)
    return out
  }

  private familyId(db: LocalDB): string {
    const id = db.session?.familyId
    if (!id) throw new AppError('Entre na sua conta de novo.')
    return id
  }

  private requireParent(db: LocalDB) {
    if (db.session?.role !== 'parent') throw new AppError('Só os responsáveis podem fazer isso.')
  }

  async getSession(): Promise<Session | null> {
    return this.read().session
  }

  async signUpParent(name: string, email: string, password: string): Promise<Session> {
    const e = email.trim().toLowerCase()
    if (password.length < 6) throw new AppError('A senha precisa ter pelo menos 6 caracteres.')
    const pw = await hash(password)
    return this.mutate((db) => {
      if (db.parents.some((p) => p.email === e)) throw new AppError('Já existe uma conta com esse e-mail.')
      db.parents.push({ email: e, passwordHash: pw, name: name.trim(), familyId: null })
      db.session = { role: 'parent', familyId: null, name: name.trim(), email: e }
      return db.session
    })
  }

  async signInParent(email: string, password: string): Promise<Session> {
    const e = email.trim().toLowerCase()
    const pw = await hash(password)
    return this.mutate((db) => {
      const p = db.parents.find((x) => x.email === e && x.passwordHash === pw)
      if (!p) throw new AppError('E-mail ou senha incorretos.')
      db.session = { role: 'parent', familyId: p.familyId, name: p.name, email: e }
      return db.session
    })
  }

  async signInChild(code: string, pin: string): Promise<Session> {
    return this.mutate((db) => {
      const fam = db.families.find((f) => f.code === code.trim().toUpperCase())
      const child = fam && db.children.find((c) => c.familyId === fam.id && c.pin === pin.trim())
      if (!fam || !child) throw new AppError('Código da família ou PIN incorretos.')
      db.session = { role: 'child', familyId: fam.id, childId: child.id }
      return db.session
    })
  }

  async signOut(): Promise<void> {
    this.mutate((db) => {
      db.session = null
    })
  }

  async createFamily(name: string, pointValueCents: number): Promise<Session> {
    return this.mutate((db) => {
      this.requireParent(db)
      const fam: Family = { id: uid(), name: name.trim(), pointValueCents, code: familyCode() }
      db.families.push(fam)
      const email = db.session?.email
      const p = db.parents.find((x) => x.email === email)
      if (p) p.familyId = fam.id
      db.session = { ...(db.session as Session & { email?: string }), familyId: fam.id }
      return db.session
    })
  }

  async updateFamily(name: string, pointValueCents: number): Promise<void> {
    this.mutate((db) => {
      this.requireParent(db)
      const f = db.families.find((x) => x.id === this.familyId(db))
      if (f) Object.assign(f, { name: name.trim(), pointValueCents })
    })
  }

  async load(): Promise<Snapshot> {
    const db = this.read()
    const fid = this.familyId(db)
    const family = db.families.find((f) => f.id === fid)
    if (!family) throw new AppError('Família não encontrada.')
    return {
      family,
      // O PIN nunca sai daqui.
      children: db.children.filter((c) => c.familyId === fid).map(({ pin: _pin, ...c }) => c),
      tasks: db.tasks.filter((t) => t.familyId === fid),
      executions: db.executions.filter((e) => e.familyId === fid),
      ledger: db.ledger.filter((l) => l.familyId === fid),
      goals: db.goals.filter((g) => g.familyId === fid),
      rewards: db.rewards.filter((r) => r.familyId === fid),
      redemptions: db.redemptions.filter((r) => r.familyId === fid),
    }
  }

  async addChild(child: NewChild): Promise<void> {
    if (!/^\d{4}$/.test(child.pin)) throw new AppError('O PIN precisa ter 4 números.')
    this.mutate((db) => {
      this.requireParent(db)
      const fid = this.familyId(db)
      if (db.children.some((c) => c.familyId === fid && c.pin === child.pin))
        throw new AppError('Outro filho já usa esse PIN. Escolha outro.')
      db.children.push({ id: uid(), familyId: fid, name: child.name.trim(), birthdate: child.birthdate, avatar: child.avatar, pin: child.pin })
    })
  }

  async removeChild(childId: string): Promise<void> {
    this.mutate((db) => {
      this.requireParent(db)
      db.children = db.children.filter((c) => c.id !== childId)
      db.executions = db.executions.filter((e) => e.childId !== childId)
      db.ledger = db.ledger.filter((l) => l.childId !== childId)
      db.goals = db.goals.filter((g) => g.childId !== childId)
      db.redemptions = db.redemptions.filter((r) => r.childId !== childId)
    })
  }

  async saveTask(task: Parameters<Repo['saveTask']>[0], id?: string): Promise<void> {
    if (!task.title.trim()) throw new AppError('Dê um nome para a tarefa.')
    if (!(task.points > 0)) throw new AppError('A tarefa precisa valer pelo menos 1 ponto.')
    if (task.recurrence === 'weekly' && task.weekdays.length === 0) throw new AppError('Escolha pelo menos um dia da semana.')
    this.mutate((db) => {
      this.requireParent(db)
      const fid = this.familyId(db)
      const existing = id && db.tasks.find((t) => t.id === id && t.familyId === fid)
      if (existing) Object.assign(existing, task)
      else db.tasks.push({ ...task, id: uid(), familyId: fid, active: true, createdAt: new Date().toISOString() })
    })
  }

  async archiveTask(id: string): Promise<void> {
    this.mutate((db) => {
      this.requireParent(db)
      const t = db.tasks.find((x) => x.id === id)
      if (t) t.active = false
    })
  }

  async submitExecution(taskId: string, childId: string, forDate: string, photo: Blob | null): Promise<void> {
    const photoUrl = photo ? await blobToDataUrl(photo) : null
    this.mutate((db) => {
      const fid = this.familyId(db)
      const task = db.tasks.find((t) => t.id === taskId && t.familyId === fid)
      if (!task) throw new AppError('Tarefa não encontrada.')
      if (task.requiresPhoto && !photoUrl) throw new AppError('Essa tarefa precisa de uma foto.')
      if (db.session?.role === 'child' && db.session.childId !== childId) throw new AppError('Você só pode enviar as suas tarefas.')
      const open = db.executions.find(
        (e) => e.taskId === taskId && e.childId === childId && e.forDate === forDate && e.status !== 'rejected',
      )
      if (open) throw new AppError('Essa tarefa já foi enviada hoje.')
      db.executions.push({
        id: uid(),
        taskId,
        childId,
        familyId: fid,
        forDate,
        photoUrl,
        status: 'pending',
        parentNote: null,
        createdAt: new Date().toISOString(),
        reviewedAt: null,
      })
    })
  }

  async reviewExecution(id: string, approve: boolean, note: string): Promise<void> {
    this.mutate((db) => {
      this.requireParent(db)
      const ex = db.executions.find((e) => e.id === id && e.familyId === this.familyId(db))
      if (!ex || ex.status !== 'pending') throw new AppError('Essa tarefa já foi avaliada.')
      ex.status = approve ? 'approved' : 'rejected'
      ex.parentNote = note.trim() || null
      ex.reviewedAt = new Date().toISOString()
      if (approve) {
        const task = db.tasks.find((t) => t.id === ex.taskId)
        db.ledger.push({
          id: uid(),
          childId: ex.childId,
          familyId: ex.familyId,
          points: task?.points ?? 0,
          kind: 'task',
          refId: ex.id,
          note: task?.title ?? 'Tarefa',
          createdAt: ex.reviewedAt,
        })
      }
    })
  }

  async addLedger(childId: string, points: number, kind: 'bonus' | 'penalty' | 'payout', note: string): Promise<void> {
    if (!Number.isFinite(points) || points <= 0) throw new AppError('Informe uma quantidade de pontos maior que zero.')
    this.mutate((db) => {
      this.requireParent(db)
      const signed = kind === 'bonus' ? points : -points
      db.ledger.push({
        id: uid(),
        childId,
        familyId: this.familyId(db),
        points: signed,
        kind,
        refId: null,
        note: note.trim(),
        createdAt: new Date().toISOString(),
      })
    })
  }

  async createGoal(childId: string, title: string, targetPoints: number, bonusPoints: number): Promise<void> {
    if (!title.trim() || !(targetPoints > 0)) throw new AppError('Dê um nome e um valor para a meta.')
    this.mutate((db) => {
      this.requireParent(db)
      db.goals.push({ id: uid(), childId, familyId: this.familyId(db), title: title.trim(), targetPoints, bonusPoints: Math.max(0, bonusPoints), achievedAt: null })
    })
  }

  async completeGoal(goalId: string): Promise<void> {
    this.mutate((db) => {
      this.requireParent(db)
      const g = db.goals.find((x) => x.id === goalId)
      if (!g || g.achievedAt) return
      g.achievedAt = new Date().toISOString()
      if (g.bonusPoints > 0)
        db.ledger.push({ id: uid(), childId: g.childId, familyId: g.familyId, points: g.bonusPoints, kind: 'goal', refId: g.id, note: `Meta: ${g.title}`, createdAt: g.achievedAt })
    })
  }

  async removeGoal(goalId: string): Promise<void> {
    this.mutate((db) => {
      this.requireParent(db)
      db.goals = db.goals.filter((g) => g.id !== goalId)
    })
  }

  async saveReward(reward: NewReward, id?: string): Promise<void> {
    if (!reward.title.trim()) throw new AppError('Dê um nome para o prêmio.')
    if (!(reward.costPoints > 0)) throw new AppError('O prêmio precisa custar pelo menos 1 ponto.')
    this.mutate((db) => {
      this.requireParent(db)
      const fid = this.familyId(db)
      const existing = id && db.rewards.find((r) => r.id === id && r.familyId === fid)
      const clean = { title: reward.title.trim(), icon: reward.icon || '🎁', costPoints: reward.costPoints }
      if (existing) Object.assign(existing, clean)
      else db.rewards.push({ ...clean, id: uid(), familyId: fid, active: true })
    })
  }

  async archiveReward(id: string): Promise<void> {
    this.mutate((db) => {
      this.requireParent(db)
      const r = db.rewards.find((x) => x.id === id && x.familyId === this.familyId(db))
      if (r) r.active = false
    })
  }

  async requestRedemption(rewardId: string, childId: string): Promise<void> {
    this.mutate((db) => {
      const fid = this.familyId(db)
      if (db.session?.role === 'child' && db.session.childId !== childId) throw new AppError('Você só pode pedir prêmios para você.')
      const reward = db.rewards.find((r) => r.id === rewardId && r.familyId === fid && r.active)
      if (!reward) throw new AppError('Esse prêmio não está mais disponível.')
      const free = available(db.ledger, db.redemptions, childId)
      if (free < reward.costPoints) throw new AppError(`Faltam ${reward.costPoints - free} pontos para esse prêmio.`)
      db.redemptions.push({ id: uid(), rewardId, childId, familyId: fid, costPoints: reward.costPoints, status: 'pending', createdAt: new Date().toISOString(), reviewedAt: null })
    })
  }

  async reviewRedemption(id: string, deliver: boolean): Promise<void> {
    this.mutate((db) => {
      this.requireParent(db)
      const r = db.redemptions.find((x) => x.id === id && x.familyId === this.familyId(db))
      if (!r || r.status !== 'pending') throw new AppError('Esse pedido já foi respondido.')
      r.status = deliver ? 'delivered' : 'rejected'
      r.reviewedAt = new Date().toISOString()
      if (deliver) {
        const reward = db.rewards.find((x) => x.id === r.rewardId)
        db.ledger.push({ id: uid(), childId: r.childId, familyId: r.familyId, points: -r.costPoints, kind: 'reward', refId: r.id, note: `Prêmio: ${reward?.title ?? ''}`, createdAt: r.reviewedAt })
      }
    })
  }

  /** Cria uma família de exemplo e entra como responsável. */
  async startDemo(): Promise<Session> {
    const db = this.read()
    const existing = db.families.find((f) => f.code === 'DEMO42')
    // Demonstração criada por uma versão antiga (sem prêmios): recomeça do zero.
    if (existing && !db.rewards.some((r) => r.familyId === existing.id)) {
      const gone = (x: { familyId: string }) => x.familyId !== existing.id
      db.families = db.families.filter((f) => f.id !== existing.id)
      db.parents = db.parents.filter((p) => p.familyId !== existing.id)
      db.children = db.children.filter(gone)
      db.tasks = db.tasks.filter(gone)
      db.executions = db.executions.filter(gone)
      db.ledger = db.ledger.filter(gone)
      db.goals = db.goals.filter(gone)
      db.redemptions = db.redemptions.filter(gone)
    }
    if (!db.families.some((f) => f.code === 'DEMO42')) seedDemo(db)
    db.session = { role: 'parent', familyId: db.families.find((f) => f.code === 'DEMO42')!.id, name: 'Responsável (demo)', email: 'demo@exemplo.com' }
    this.write(db)
    return db.session
  }
}

function photoPlaceholder(label: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${color}"/><text x="200" y="160" font-family="sans-serif" font-size="26" fill="#fff" text-anchor="middle">${label}</text></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

function seedDemo(db: LocalDB) {
  const fid = uid()
  const now = new Date()
  const today = todayISO(now)
  const daysAgo = (n: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() - n)
    return d
  }
  db.families.push({ id: fid, name: 'Família Demo', pointValueCents: 10, code: 'DEMO42' })
  db.parents.push({ email: 'demo@exemplo.com', passwordHash: '', name: 'Responsável (demo)', familyId: fid })
  const lia = { id: uid(), familyId: fid, name: 'Lia', birthdate: `${now.getFullYear() - 9}-03-12`, avatar: '🦊', pin: '1234' }
  const theo = { id: uid(), familyId: fid, name: 'Theo', birthdate: `${now.getFullYear() - 13}-07-02`, avatar: '🐢', pin: '4321' }
  db.children.push(lia, theo)
  const mk = (title: string, points: number, recurrence: Task['recurrence'], childIds: string[], weekdays: number[] = [], requiresPhoto = true): Task => ({
    id: uid(),
    familyId: fid,
    title,
    description: '',
    points,
    recurrence,
    weekdays,
    childIds,
    requiresPhoto,
    active: true,
    createdAt: daysAgo(20).toISOString(),
  })
  const tCama = mk('Arrumar a cama', 5, 'daily', [])
  const tMochila = mk('Arrumar a mochila para a escola', 5, 'daily', [lia.id])
  const tLouca = mk('Lavar a louça do jantar', 15, 'daily', [theo.id])
  const tLeitura = mk('Ler 15 minutos', 10, 'daily', [lia.id], [], false)
  const tQuarto = mk('Organizar o quarto', 20, 'weekly', [], [6])
  const tLixo = mk('Separar o lixo reciclável', 10, 'weekly', [theo.id], [2, 5])
  db.tasks.push(tCama, tMochila, tLouca, tLeitura, tQuarto, tLixo)

  // Histórico aprovado nos últimos dias.
  const history: [Task, typeof lia, number][] = []
  for (let d = 1; d <= 14; d++) {
    history.push([tCama, lia, d], [tCama, theo, d])
    if (d % 2 === 0) history.push([tLouca, theo, d], [tLeitura, lia, d])
    if (d % 3 === 0) history.push([tMochila, lia, d])
  }
  for (const [task, child, d] of history) {
    const when = daysAgo(d)
    const exId = uid()
    db.executions.push({ id: exId, taskId: task.id, childId: child.id, familyId: fid, forDate: todayISO(when), photoUrl: null, status: 'approved', parentNote: null, createdAt: when.toISOString(), reviewedAt: when.toISOString() })
    db.ledger.push({ id: uid(), childId: child.id, familyId: fid, points: task.points, kind: 'task', refId: exId, note: task.title, createdAt: when.toISOString() })
  }
  db.ledger.push({ id: uid(), childId: theo.id, familyId: fid, points: 30, kind: 'bonus', refId: null, note: 'Ajudou o vizinho com as compras', createdAt: daysAgo(5).toISOString() })
  db.ledger.push({ id: uid(), childId: lia.id, familyId: fid, points: -50, kind: 'payout', refId: null, note: 'Mesada paga (R$ 5,00)', createdAt: daysAgo(7).toISOString() })

  // Duas tarefas esperando aprovação hoje.
  db.executions.push(
    { id: uid(), taskId: tCama.id, childId: lia.id, familyId: fid, forDate: today, photoUrl: photoPlaceholder('Cama arrumada 🛏️', '#5C8D89'), status: 'pending', parentNote: null, createdAt: now.toISOString(), reviewedAt: null },
    { id: uid(), taskId: tLouca.id, childId: theo.id, familyId: fid, forDate: today, photoUrl: photoPlaceholder('Louça lavada 🍽️', '#C47F3D'), status: 'pending', parentNote: null, createdAt: now.toISOString(), reviewedAt: null },
  )
  const rTela = { id: uid(), familyId: fid, title: '30 minutos a mais de tela', icon: '📱', costPoints: 40, active: true }
  const rJantar = { id: uid(), familyId: fid, title: 'Escolher o jantar de sexta', icon: '🍕', costPoints: 60, active: true }
  const rPasseio = { id: uid(), familyId: fid, title: 'Passeio no parque com a família', icon: '🌳', costPoints: 150, active: true }
  db.rewards.push(rTela, rJantar, rPasseio)
  db.redemptions.push({ id: uid(), rewardId: rTela.id, childId: theo.id, familyId: fid, costPoints: rTela.costPoints, status: 'pending', createdAt: now.toISOString(), reviewedAt: null })
  db.goals.push(
    { id: uid(), childId: lia.id, familyId: fid, title: 'Kit de pintura', targetPoints: 400, bonusPoints: 20, achievedAt: null },
    { id: uid(), childId: theo.id, familyId: fid, title: 'Fone de ouvido', targetPoints: 800, bonusPoints: 40, achievedAt: null },
  )
}
