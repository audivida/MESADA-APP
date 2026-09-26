export type Recurrence = 'once' | 'daily' | 'weekly'
export type ExecutionStatus = 'pending' | 'approved' | 'rejected'
export type LedgerKind = 'task' | 'goal' | 'bonus' | 'penalty' | 'payout'

export interface Family {
  id: string
  name: string
  /** Quanto vale 1 ponto, em centavos. Ex.: 10 = R$ 0,10 por ponto. */
  pointValueCents: number
  /** Código curto que o filho digita para entrar no app. */
  code: string
}

export interface Child {
  id: string
  familyId: string
  name: string
  birthdate: string | null
  avatar: string
}

export interface Task {
  id: string
  familyId: string
  title: string
  description: string
  points: number
  recurrence: Recurrence
  /** Dias da semana (0 = domingo) para tarefas semanais. */
  weekdays: number[]
  /** Filhos que fazem a tarefa. Vazio = todos. */
  childIds: string[]
  requiresPhoto: boolean
  active: boolean
  createdAt: string
}

export interface Execution {
  id: string
  taskId: string
  childId: string
  familyId: string
  /** Dia a que a execução se refere (AAAA-MM-DD). */
  forDate: string
  photoUrl: string | null
  status: ExecutionStatus
  parentNote: string | null
  createdAt: string
  reviewedAt: string | null
}

/** Cada ganho ou gasto de pontos vira uma linha. O saldo é a soma. */
export interface LedgerEntry {
  id: string
  childId: string
  familyId: string
  points: number
  kind: LedgerKind
  refId: string | null
  note: string
  createdAt: string
}

export interface Goal {
  id: string
  childId: string
  familyId: string
  title: string
  targetPoints: number
  bonusPoints: number
  achievedAt: string | null
}

export interface NewTask {
  title: string
  description: string
  points: number
  recurrence: Recurrence
  weekdays: number[]
  childIds: string[]
  requiresPhoto: boolean
}
