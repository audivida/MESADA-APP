import type { Child, Execution, LedgerEntry, LimitPeriod, Redemption, Reward, Task, TaskCategory } from './types'

export interface Level {
  id: 'bronze' | 'prata' | 'ouro' | 'diamante'
  name: string
  min: number
  color: string
}

/** Níveis por pontos ganhos no total (pagamentos de mesada não derrubam o nível). */
export const LEVELS: Level[] = [
  { id: 'bronze', name: 'Bronze', min: 0, color: '#B7773F' },
  { id: 'prata', name: 'Prata', min: 300, color: '#9AA6AC' },
  { id: 'ouro', name: 'Ouro', min: 1000, color: '#E0A423' },
  { id: 'diamante', name: 'Diamante', min: 2500, color: '#4FC3DC' },
]

export function balance(entries: LedgerEntry[], childId: string): number {
  return entries.filter((e) => e.childId === childId).reduce((s, e) => s + e.points, 0)
}

/** Saldo que ainda pode ser gasto: desconta pedidos de prêmio esperando entrega. */
export function available(entries: LedgerEntry[], redemptions: Redemption[], childId: string): number {
  const held = redemptions.filter((r) => r.childId === childId && r.status === 'pending').reduce((s, r) => s + r.costPoints, 0)
  return balance(entries, childId) - held
}

export function totalEarned(entries: LedgerEntry[], childId: string): number {
  return entries
    .filter((e) => e.childId === childId && e.points > 0)
    .reduce((s, e) => s + e.points, 0)
}

export function levelFor(earned: number): { level: Level; next: Level | null; progress: number } {
  let i = 0
  for (let k = 0; k < LEVELS.length; k++) if (earned >= LEVELS[k].min) i = k
  const level = LEVELS[i]
  const next = LEVELS[i + 1] ?? null
  const progress = next ? (earned - level.min) / (next.min - level.min) : 1
  return { level, next, progress: Math.max(0, Math.min(1, progress)) }
}

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function pointsToCents(points: number, pointValueCents: number): number {
  return points * pointValueCents
}

export function todayISO(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function taskAppliesTo(task: Task, child: Pick<Child, 'id'>): boolean {
  return task.active && (task.childIds.length === 0 || task.childIds.includes(child.id))
}

export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

export function scheduledOn(task: Task, date: Date): boolean {
  if (task.recurrence === 'weekly') return task.weekdays.includes(date.getDay())
  // Mensal: aparece a partir do dia escolhido (ou do último dia, em meses curtos) até o fim do mês.
  if (task.recurrence === 'monthly') return date.getDate() >= Math.min(task.monthDay ?? 1, daysInMonth(date))
  return true
}

/**
 * Situação da tarefa para um filho num dia:
 * - 'todo': pode fazer
 * - 'pending': enviou e espera aprovação
 * - 'done': aprovada
 * - 'rejected': recusada hoje (pode refazer)
 * - null: não é para hoje
 */
export function taskState(
  task: Task,
  childId: string,
  executions: Execution[],
  date = new Date(),
): 'todo' | 'pending' | 'done' | 'rejected' | null {
  if (!taskAppliesTo(task, { id: childId }) || !scheduledOn(task, date)) return null
  const day = todayISO(date)
  const mine = executions
    .filter((e) => e.taskId === task.id && e.childId === childId && (task.recurrence === 'once' || e.forDate === day || (task.recurrence === 'monthly' && e.forDate.slice(0, 7) === day.slice(0, 7))))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const last = mine[0]
  if (!last) return 'todo'
  if (last.status === 'approved') return 'done'
  if (last.status === 'pending') return 'pending'
  return 'rejected'
}

export function ageFrom(birthdate: string | null, now = new Date()): number | null {
  if (!birthdate) return null
  const b = new Date(birthdate + 'T00:00:00')
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export const CATEGORIES: Record<TaskCategory, { label: string; color: string; icon: string }> = {
  casa: { label: 'Casa', color: '#34d399', icon: '🏠' },
  estudos: { label: 'Estudos', color: '#60a5fa', icon: '📚' },
  saude: { label: 'Saúde e esporte', color: '#fbbf24', icon: '⚽' },
  cuidados: { label: 'Cuidados pessoais', color: '#c084fc', icon: '🪥' },
}

export const LIMIT_LABEL: Record<LimitPeriod, string> = { week: 'semana', month: 'mês', year: 'ano' }
export const THIS_PERIOD: Record<LimitPeriod, string> = { week: 'nesta semana', month: 'neste mês', year: 'neste ano' }

/** Início do período atual. A semana começa na segunda, como no servidor. */
export function periodStart(period: LimitPeriod, now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  else if (period === 'month') d.setDate(1)
  else d.setMonth(0, 1)
  return d
}

/** Quantos pedidos ainda cabem no período. Nulo = prêmio sem limite. */
export function redemptionsLeft(reward: Reward, redemptions: Redemption[], childId: string, now = new Date()): number | null {
  if (!reward.limitCount || !reward.limitPeriod) return null
  const since = periodStart(reward.limitPeriod, now).getTime()
  const used = redemptions.filter(
    (r) => r.rewardId === reward.id && r.childId === childId && r.status !== 'rejected' && new Date(r.createdAt).getTime() >= since,
  ).length
  return Math.max(0, reward.limitCount - used)
}
