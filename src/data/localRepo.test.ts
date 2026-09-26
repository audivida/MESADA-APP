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
    await repo.saveTask({ title: 'Ler', description: '', points: 10, recurrence: 'daily', weekdays: [], childIds: [], requiresPhoto: false, category: null, helpUrl: null, monthDay: null })
    let snap = await repo.load()
    const lia = snap.children[0]
    expect(lia).not.toHaveProperty('pin')
    const code = snap.family.code

    await repo.signOut()
    await expect(repo.signInChild(code, '9999')).rejects.toThrow()
    await repo.signInChild(code.toLowerCase(), '1234')
    await expect(repo.saveTask({ title: 'x', description: '', points: 99, recurrence: 'daily', weekdays: [], childIds: [], requiresPhoto: false, category: null, helpUrl: null, monthDay: null })).rejects.toThrow()
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

describe('loja de prêmios', () => {
  it('reserva o saldo no pedido e só desconta na entrega', async () => {
    const repo = new LocalRepo(memory())
    await repo.signUpParent('Grazi', 'g@exemplo.com', 'segredo1')
    await repo.createFamily('Família G', 10)
    await repo.addChild({ name: 'Lia', birthdate: null, avatar: '🦊', pin: '1234' })
    let snap = await repo.load()
    const lia = snap.children[0]
    await repo.addLedger(lia.id, 50, 'bonus', 'Começo')
    await repo.saveReward({ title: 'Tela extra', icon: '📱', costPoints: 30, limitCount: null, limitPeriod: null })
    await repo.saveReward({ title: 'Bicicleta', icon: '🚲', costPoints: 500, limitCount: null, limitPeriod: null })
    snap = await repo.load()
    const tela = snap.rewards.find((r) => r.costPoints === 30)!
    const bike = snap.rewards.find((r) => r.costPoints === 500)!

    await repo.signOut()
    await repo.signInChild(snap.family.code, '1234')
    await expect(repo.saveReward({ title: 'x', icon: '', costPoints: 1, limitCount: null, limitPeriod: null })).rejects.toThrow()
    await expect(repo.requestRedemption(bike.id, lia.id)).rejects.toThrow('Faltam 450')
    await repo.requestRedemption(tela.id, lia.id)
    await expect(repo.requestRedemption(tela.id, lia.id)).rejects.toThrow('Faltam 10')
    snap = await repo.load()
    expect(balance(snap.ledger, lia.id)).toBe(50)
    await expect(repo.reviewRedemption(snap.redemptions[0].id, true)).rejects.toThrow()

    await repo.signOut()
    await repo.signInParent('g@exemplo.com', 'segredo1')
    await repo.reviewRedemption(snap.redemptions[0].id, true)
    await expect(repo.reviewRedemption(snap.redemptions[0].id, true)).rejects.toThrow()
    snap = await repo.load()
    expect(balance(snap.ledger, lia.id)).toBe(20)
    expect(snap.ledger.find((l) => l.kind === 'reward')?.note).toBe('Prêmio: Tela extra')
  })

  it('façanhas, elogios e limite de prêmio', async () => {
    const repo = new LocalRepo(memory())
    await repo.signUpParent('Grazi', 'f@exemplo.com', 'segredo1')
    await repo.createFamily('Família F', 10)
    await repo.addChild({ name: 'Lia', birthdate: null, avatar: '🦊', pin: '1234' })
    await repo.addChild({ name: 'Theo', birthdate: null, avatar: '🐢', pin: '4321' })
    await repo.saveReward({ title: 'Açaí', icon: '🍧', costPoints: 5, limitCount: 1, limitPeriod: 'week' })
    let snap = await repo.load()
    const [lia, theo] = snap.children
    await repo.addLedger(lia.id, 50, 'bonus', 'Começo')

    await repo.signOut()
    await repo.signInChild(snap.family.code, '1234')
    await repo.submitFeat(lia.id, 'Lavei a louça sem ninguém pedir', null)
    await expect(repo.submitFeat(theo.id, 'x', null)).rejects.toThrow()
    await repo.sendPraise(theo.id, 'Me ajudou no dever', 500)
    await expect(repo.sendPraise(lia.id, 'Eu sou demais', 0)).rejects.toThrow()
    await expect(repo.reviewFeat((await repo.load()).feats[0].id, true, 99, '')).rejects.toThrow()
    const acai = snap.rewards[0]
    await repo.requestRedemption(acai.id, lia.id)
    await expect(repo.requestRedemption(acai.id, lia.id)).rejects.toThrow('nesta semana')

    await repo.signOut()
    await repo.signInParent('f@exemplo.com', 'segredo1')
    snap = await repo.load()
    expect(snap.praises[0]).toMatchObject({ status: 'pending', points: 0, fromName: 'Lia' })
    await expect(repo.reviewFeat(snap.feats[0].id, true, 0, '')).rejects.toThrow('pontos')
    await repo.reviewFeat(snap.feats[0].id, true, 15, 'Que orgulho!')
    await repo.reviewPraise(snap.praises[0].id, true, 5)
    await repo.sendPraise(lia.id, 'Obrigada pelas plantas', 3)
    await repo.reviewRedemption(snap.redemptions[0].id, false)
    snap = await repo.load()
    expect(balance(snap.ledger, lia.id)).toBe(50 + 15 + 3)
    expect(balance(snap.ledger, theo.id)).toBe(5)
    expect(snap.ledger.filter((l) => l.kind === 'praise')).toHaveLength(2)
    // Pedido recusado não conta no limite.
    await repo.requestRedemption(snap.rewards[0].id, lia.id)
  })
})
