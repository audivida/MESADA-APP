import { LEVELS, type Level } from './rules'
import type { Execution } from './types'

export type StationKind = 'start' | 'step' | 'chest' | 'trophy'

export interface Station {
  index: number
  /** Pontos ganhos no total para chegar aqui. */
  points: number
  kind: StationKind
  level: Level
  /** Dica curta de educação financeira que a criança "desbloqueia". */
  tip: string
}

export interface Unit {
  level: Level
  title: string
  subtitle: string
  stations: Station[]
}

/** Até onde a trilha vai no nível Diamante. */
export const TRAIL_END = 5000
const STEPS_PER_UNIT = 6

const UNIT_TEXT: Record<Level['id'], { title: string; subtitle: string }> = {
  bronze: { title: 'Primeiros passos', subtitle: 'Aprender que tarefa feita vira ponto' },
  prata: { title: 'Criando hábitos', subtitle: 'Fazer todo dia, sem ninguém pedir' },
  ouro: { title: 'Poupador de verdade', subtitle: 'Juntar para conquistar algo grande' },
  diamante: { title: 'Mestre da mesada', subtitle: 'Planejar, poupar e ajudar os outros' },
}

const TIPS = [
  'Toda viagem começa com um passo. Sua primeira tarefa já conta!',
  'Ponto é esforço guardado. Quanto mais você ajuda, mais ele cresce.',
  'Dinheiro não nasce em árvore: ele vem do trabalho de alguém.',
  'Antes de gastar, pergunte: eu preciso ou só quero agora?',
  'Guardar um pouquinho toda semana vira muito com o tempo.',
  'Baú aberto! Quem cumpre o combinado ganha a confiança da família.',
  'Uma meta clara ajuda a não gastar com qualquer coisa.',
  'Comparar preços é um superpoder: o mesmo item pode custar menos em outro lugar.',
  'Esperar um pouco para comprar é sinal de que você está no controle.',
  'Dividir a mesada em gastar, guardar e doar deixa tudo mais fácil.',
  'Errar faz parte. O importante é aprender e tentar de novo amanhã.',
  'Presentes caros não são os mais valiosos. Tempo junto também vale muito.',
  'Juntar para algo grande é como subir uma escada: um degrau por vez.',
  'Anote o que você gasta. Assim você descobre para onde vai seu dinheiro.',
  'Emprestado é diferente de dado: o que você pega emprestado precisa voltar.',
  'Poupar hoje é dar um presente para você mesmo no futuro.',
  'Ajudar alguém com o que você tem também é usar bem o dinheiro.',
  'Propaganda quer que você compre. Pense duas vezes antes de decidir.',
  'Um orçamento é só um plano: quanto entra, quanto sai e quanto sobra.',
  'Coisas quebram, perdem a graça ou saem de moda. Conhecimento fica.',
  'Quem planeja consegue mais com o mesmo dinheiro.',
  'Você chegou longe porque não desistiu. Isso vale mais que qualquer ponto!',
]

export function buildTrail(): Unit[] {
  const units: Unit[] = []
  let index = 0
  LEVELS.forEach((level, li) => {
    const next = LEVELS[li + 1]?.min ?? TRAIL_END
    const span = next - level.min
    const stations: Station[] = []
    for (let k = li === 0 ? 0 : 1; k < STEPS_PER_UNIT; k++) {
      const points = level.min + Math.round((span * k) / STEPS_PER_UNIT / 10) * 10
      const kind: StationKind = k === 0 ? 'start' : k === 3 ? 'chest' : 'step'
      stations.push({ index, points, kind, level, tip: TIPS[index % TIPS.length] })
      index++
    }
    // O troféu fecha o nível e leva ao próximo.
    stations.push({ index, points: next, kind: 'trophy', level, tip: TIPS[index % TIPS.length] })
    index++
    units.push({ level, ...UNIT_TEXT[level.id], stations })
  })
  return units
}

export const TRAIL = buildTrail()
export const STATIONS = TRAIL.flatMap((u) => u.stations)

/** Índice da última estação alcançada com os pontos ganhos. */
export function currentStation(earned: number): number {
  let i = 0
  for (const s of STATIONS) if (earned >= s.points) i = s.index
  return i
}

export function nextStation(earned: number): Station | null {
  return STATIONS.find((s) => s.points > earned) ?? null
}

/**
 * Dias seguidos com pelo menos uma tarefa enviada (e não recusada).
 * Se hoje ainda não teve tarefa, a sequência de ontem continua valendo.
 */
export function streak(executions: Execution[], childId: string, today = new Date()): { days: number; doneToday: boolean } {
  const days = new Set(executions.filter((e) => e.childId === childId && e.status !== 'rejected').map((e) => e.forDate))
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const cursor = new Date(today)
  const doneToday = days.has(iso(cursor))
  if (!doneToday) cursor.setDate(cursor.getDate() - 1)
  let count = 0
  while (days.has(iso(cursor))) {
    count++
    cursor.setDate(cursor.getDate() - 1)
  }
  return { days: count, doneToday }
}
