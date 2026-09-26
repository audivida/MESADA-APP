export type Recurrence = 'once' | 'daily' | 'weekly'
export type ExecutionStatus = 'pending' | 'approved' | 'rejected'
export type LedgerKind = 'task' | 'goal' | 'bonus' | 'penalty' | 'payout' | 'reward'

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

/** Prêmio que o filho pode trocar por pontos (tempo de tela, passeio...). */
export interface Reward {
  id: string
  familyId: string
  title: string
  icon: string
  costPoints: number
  active: boolean
}

export type RedemptionStatus = 'pending' | 'delivered' | 'rejected'

/** Pedido de troca: os pontos só saem quando os pais confirmam a entrega. */
export interface Redemption {
  id: string
  rewardId: string
  childId: string
  familyId: string
  costPoints: number
  status: RedemptionStatus
  createdAt: string
  reviewedAt: string | null
}

export interface NewReward {
  title: string
  icon: string
  costPoints: number
}
