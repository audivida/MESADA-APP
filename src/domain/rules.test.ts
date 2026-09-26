import { describe, expect, it } from 'vitest'
import { balance, levelFor, taskState, totalEarned, ageFrom } from './rules'
import type { Execution, LedgerEntry, Task } from './types'

const task = (over: Partial<Task> = {}): Task => ({
  id: 't1', familyId: 'f', title: 'Cama', description: '', points: 5, recurrence: 'daily', weekdays: [], childIds: [],
  requiresPhoto: false, active: true, createdAt: '2026-01-01T00:00:00Z', ...over,
})
const ex = (over: Partial<Execution>): Execution => ({
  id: Math.random().toString(), taskId: 't1', childId: 'c1', familyId: 'f', forDate: '2026-09-26', photoUrl: null,
  status: 'pending', parentNote: null, createdAt: '2026-09-26T10:00:00Z', reviewedAt: null, ...over,
})
const entry = (points: number, kind: LedgerEntry['kind'] = 'task', childId = 'c1'): LedgerEntry => ({
  id: Math.random().toString(), childId, familyId: 'f', points, kind, refId: null, note: '', createdAt: '2026-09-26T00:00:00Z',
})
const sat = new Date('2026-09-26T12:00:00') // sábado

describe('saldo e nível', () => {
  const ledger = [entry(100), entry(50, 'bonus'), entry(-30, 'payout'), entry(-10, 'penalty'), entry(999, 'task', 'outro')]
  it('soma só o filho certo', () => expect(balance(ledger, 'c1')).toBe(110))
  it('pagamento não reduz o total ganho', () => expect(totalEarned(ledger, 'c1')).toBe(150))
  it('níveis por faixa', () => {
    expect(levelFor(0).level.id).toBe('bronze')
    expect(levelFor(300).level.id).toBe('prata')
    expect(levelFor(1000).level.id).toBe('ouro')
    expect(levelFor(5000)).toMatchObject({ next: null, progress: 1 })
    expect(levelFor(150).progress).toBeCloseTo(0.5)
  })
})

describe('tarefa do dia', () => {
  it('diária sem envio está a fazer', () => expect(taskState(task(), 'c1', [], sat)).toBe('todo'))
  it('pendente e aprovada', () => {
    expect(taskState(task(), 'c1', [ex({})], sat)).toBe('pending')
    expect(taskState(task(), 'c1', [ex({ status: 'approved' })], sat)).toBe('done')
  })
  it('envio de ontem não conta para hoje', () => expect(taskState(task(), 'c1', [ex({ forDate: '2026-09-25', status: 'approved' })], sat)).toBe('todo'))
  it('recusada pode refazer, e o envio mais novo vale', () => {
    expect(taskState(task(), 'c1', [ex({ status: 'rejected' })], sat)).toBe('rejected')
    expect(taskState(task(), 'c1', [ex({ status: 'rejected' }), ex({ createdAt: '2026-09-26T11:00:00Z' })], sat)).toBe('pending')
  })
  it('semanal só nos dias marcados', () => {
    expect(taskState(task({ recurrence: 'weekly', weekdays: [6] }), 'c1', [], sat)).toBe('todo')
    expect(taskState(task({ recurrence: 'weekly', weekdays: [1] }), 'c1', [], sat)).toBeNull()
  })
  it('uma vez só: aprovada em qualquer dia encerra', () =>
    expect(taskState(task({ recurrence: 'once' }), 'c1', [ex({ forDate: '2026-09-01', status: 'approved' })], sat)).toBe('done'))
  it('respeita a lista de filhos e tarefas arquivadas', () => {
    expect(taskState(task({ childIds: ['c2'] }), 'c1', [], sat)).toBeNull()
    expect(taskState(task({ active: false }), 'c1', [], sat)).toBeNull()
  })
})

it('idade', () => expect(ageFrom('2017-09-27', sat)).toBe(8))

it('saldo livre desconta pedidos de prêmio abertos', async () => {
  const { available } = await import('./rules')
  const ledger = [entry(100)]
  const red = (status: 'pending' | 'delivered' | 'rejected') => ({ id: status, rewardId: 'r', childId: 'c1', familyId: 'f', costPoints: 30, status, createdAt: '', reviewedAt: null })
  expect(available(ledger, [red('pending'), red('rejected'), red('delivered')], 'c1')).toBe(70)
})
