// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { LocalRepo } from './localRepo'
import { balance } from '../domain/rules'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe('fluxo completo no modo local', () => {
  it('pai cria família, filho envia, pai aprova, pontos entram', async () => {
    const store = memory()
    const repo = new LocalRepo(store)
    await repo.signUpParent('Grazi', 'grazi@exemplo.com', 'segredo1')
    await repo.createFamily('Família G', 10)
    await repo.addChild({ name: 'Lia', birthdate: '2017-03-12', avatar: '🦊', pin: '1234' })
    await expect(repo.addChild({ name: 'Bia', birthdate: null, avatar: '🐼', pin: '1234' })).rejects.toThrow('PIN')
    await repo.saveTask({ title: 'Ler', description: '', points: 10, recurrence: 'daily', weekdays: [], childIds: [], requiresPhoto: false })
    let snap = await repo.load()
    const lia = snap.children[0]
    expect(lia).not.toHaveProperty('pin')
    const code = snap.family.code

    await repo.signOut()
    await expect(repo.signInChild(code, '9999')).rejects.toThrow()
    await repo.signInChild(code.toLowerCase(), '1234')
    await expect(repo.saveTask({ title: 'x', description: '', points: 99, recurrence: 'daily', weekdays: [], childIds: [], requiresPhoto: false })).rejects.toThrow()
    await repo.submitExecution(snap.tasks[0].id, lia.id, '2026-09-26', null)
    await expect(repo.submitExecution(snap.tasks[0].id, lia.id, '2026-09-26', null)).rejects.toThrow('já foi enviada')
    snap = await repo.load()
    await expect(repo.reviewExecution(snap.executions[0].id, true, '')).rejects.toThrow()

    await repo.signOut()
    await repo.signInParent('GRAZI@exemplo.com', 'segredo1')
    await repo.reviewExecution(snap.executions[0].id, true, 'Boa!')
    await expect(repo.reviewExecution(snap.executions[0].id, true, '')).rejects.toThrow()
    await repo.addLedger(lia.id, 4, 'payout', 'Mesada')
    await repo.createGoal(lia.id, 'Bola', 100, 5)
    snap = await repo.load()
    await repo.completeGoal(snap.goals[0].id)
    await repo.completeGoal(snap.goals[0].id)
    snap = await repo.load()
    expect(balance(snap.ledger, lia.id)).toBe(10 - 4 + 5)
    expect(snap.executions[0].parentNote).toBe('Boa!')
  })

  it('demonstração já vem com dados', async () => {
    const repo = new LocalRepo(memory())
    await repo.startDemo()
    const snap = await repo.load()
    expect(snap.children.map((c) => c.name)).toEqual(['Lia', 'Theo'])
    expect(snap.executions.filter((e) => e.status === 'pending')).toHaveLength(2)
  })
})
