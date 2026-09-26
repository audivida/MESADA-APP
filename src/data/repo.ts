import type { Child, Execution, Family, Goal, LedgerEntry, LedgerKind, NewReward, NewTask, Redemption, Reward, Task } from '../domain/types'

export type Session =
  | { role: 'parent'; familyId: string | null; name: string }
  | { role: 'child'; familyId: string; childId: string }

export interface Snapshot {
  family: Family
  children: Child[]
  tasks: Task[]
  executions: Execution[]
  ledger: LedgerEntry[]
  goals: Goal[]
  rewards: Reward[]
  redemptions: Redemption[]
}

export interface NewChild {
  name: string
  birthdate: string | null
  avatar: string
  pin: string
}

/**
 * Tudo o que as telas precisam do "servidor".
 * Há duas implementações: LocalRepo (demonstração, no navegador) e SupabaseRepo.
 */
export interface Repo {
  readonly mode: 'local' | 'supabase'
  getSession(): Promise<Session | null>
  signUpParent(name: string, email: string, password: string): Promise<Session>
  signInParent(email: string, password: string): Promise<Session>
  signInChild(familyCode: string, pin: string): Promise<Session>
  signOut(): Promise<void>

  createFamily(name: string, pointValueCents: number): Promise<Session>
  updateFamily(name: string, pointValueCents: number): Promise<void>
  load(): Promise<Snapshot>

  addChild(child: NewChild): Promise<void>
  removeChild(childId: string): Promise<void>

  saveTask(task: NewTask, id?: string): Promise<void>
  archiveTask(id: string): Promise<void>

  submitExecution(taskId: string, childId: string, forDate: string, photo: Blob | null): Promise<void>
  reviewExecution(id: string, approve: boolean, note: string): Promise<void>

  addLedger(childId: string, points: number, kind: Exclude<LedgerKind, 'task' | 'goal' | 'reward'>, note: string): Promise<void>

  createGoal(childId: string, title: string, targetPoints: number, bonusPoints: number): Promise<void>
  completeGoal(goalId: string): Promise<void>
  removeGoal(goalId: string): Promise<void>

  saveReward(reward: NewReward, id?: string): Promise<void>
  archiveReward(id: string): Promise<void>
  /** Filho pede um prêmio. Precisa ter saldo, contando pedidos ainda abertos. */
  requestRedemption(rewardId: string, childId: string): Promise<void>
  /** Pais entregam (desconta os pontos) ou recusam. */
  reviewRedemption(id: string, deliver: boolean): Promise<void>
}

export class AppError extends Error {}
