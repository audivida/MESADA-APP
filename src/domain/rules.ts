import type { Child, Execution, LedgerEntry, Task } from './types'

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

export function totalEarned(entries: LedgerEntry[], childId: string): number {
  return entries
    .filter((e) => e.childId === childId && e.points > 0 && e.kind !== 'payout')
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

export function scheduledOn(task: Task, date: Date): boolean {
  if (task.recurrence === 'weekly') return task.weekdays.includes(date.getDay())
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
    .filter((e) => e.taskId === task.id && e.childId === childId && (task.recurrence === 'once' || e.forDate === day))
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
