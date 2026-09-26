import { describe, expect, it } from 'vitest'
import { STATIONS, TRAIL, currentStation, nextStation, streak } from './trail'
import type { Execution } from './types'

describe('trilha', () => {
  it('tem um bloco por nível, em ordem crescente, terminando em troféu', () => {
    expect(TRAIL.map((u) => u.level.id)).toEqual(['bronze', 'prata', 'ouro', 'diamante'])
    for (const u of TRAIL) expect(u.stations.at(-1)?.kind).toBe('trophy')
    const pts = STATIONS.map((s) => s.points)
    expect([...pts].sort((a, b) => a - b)).toEqual(pts)
    expect(new Set(pts).size).toBe(pts.length)
    expect(STATIONS.map((s) => s.index)).toEqual(STATIONS.map((_, i) => i))
  })
  it('troféus caem exatamente na troca de nível', () => {
    expect(TRAIL[0].stations.at(-1)?.points).toBe(300)
    expect(TRAIL[1].stations.at(-1)?.points).toBe(1000)
    expect(TRAIL[2].stations.at(-1)?.points).toBe(2500)
  })
  it('acha a estação atual e a próxima', () => {
    expect(currentStation(0)).toBe(0)
    expect(currentStation(49)).toBe(0)
    expect(currentStation(50)).toBe(1)
    expect(STATIONS[currentStation(300)].kind).toBe('trophy')
    expect(nextStation(0)?.points).toBe(50)
    expect(nextStation(99999)).toBeNull()
  })
})

describe('sequência de dias', () => {
  const ex = (forDate: string, status: Execution['status'] = 'approved'): Execution => ({
    id: forDate + status, taskId: 't', childId: 'c1', familyId: 'f', forDate, photoUrl: null, status, parentNote: null, createdAt: '', reviewedAt: null,
  })
  const today = new Date('2026-09-26T12:00:00')
  it('conta dias seguidos até hoje', () =>
    expect(streak([ex('2026-09-26'), ex('2026-09-25', 'pending'), ex('2026-09-24'), ex('2026-09-22')], 'c1', today)).toEqual({ days: 3, doneToday: true }))
  it('se hoje ainda não fez, vale a sequência até ontem', () =>
    expect(streak([ex('2026-09-25'), ex('2026-09-24')], 'c1', today)).toEqual({ days: 2, doneToday: false }))
  it('recusada não conta e buraco zera', () => {
    expect(streak([ex('2026-09-26', 'rejected')], 'c1', today).days).toBe(0)
    expect(streak([ex('2026-09-24')], 'c1', today).days).toBe(0)
  })
})
