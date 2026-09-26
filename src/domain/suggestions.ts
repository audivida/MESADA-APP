import type { Recurrence } from './types'

export interface Suggestion {
  title: string
  points: number
  recurrence: Recurrence
}

export interface AgeBand {
  label: string
  min: number
  max: number
  tasks: Suggestion[]
}

/** Sugestões de tarefas por idade. Os pais podem editar tudo depois. */
export const AGE_BANDS: AgeBand[] = [
  {
    label: '3 a 5 anos',
    min: 3,
    max: 5,
    tasks: [
      { title: 'Guardar os brinquedos depois de brincar', points: 5, recurrence: 'daily' },
      { title: 'Colocar a roupa suja no cesto', points: 3, recurrence: 'daily' },
      { title: 'Ajudar a dar comida para o pet', points: 5, recurrence: 'daily' },
      { title: 'Regar a plantinha', points: 3, recurrence: 'weekly' },
      { title: 'Escovar os dentes sem precisar lembrar', points: 5, recurrence: 'daily' },
    ],
  },
  {
    label: '6 a 8 anos',
    min: 6,
    max: 8,
    tasks: [
      { title: 'Arrumar a mochila para a escola', points: 5, recurrence: 'daily' },
      { title: 'Arrumar a cama', points: 5, recurrence: 'daily' },
      { title: 'Pôr a mesa para o jantar', points: 5, recurrence: 'daily' },
      { title: 'Dobrar e guardar as próprias roupas', points: 10, recurrence: 'weekly' },
      { title: 'Ler 15 minutos', points: 10, recurrence: 'daily' },
    ],
  },
  {
    label: '9 a 11 anos',
    min: 9,
    max: 11,
    tasks: [
      { title: 'Tirar a mesa e limpar depois da refeição', points: 10, recurrence: 'daily' },
      { title: 'Separar o lixo reciclável', points: 10, recurrence: 'weekly' },
      { title: 'Ajudar a guardar as compras', points: 10, recurrence: 'weekly' },
      { title: 'Fazer a lição de casa sem lembrete', points: 15, recurrence: 'daily' },
      { title: 'Preparar o próprio lanche', points: 10, recurrence: 'daily' },
    ],
  },
  {
    label: '12 a 14 anos',
    min: 12,
    max: 14,
    tasks: [
      { title: 'Lavar a louça', points: 15, recurrence: 'daily' },
      { title: 'Passar aspirador na sala', points: 20, recurrence: 'weekly' },
      { title: 'Organizar o quarto', points: 20, recurrence: 'weekly' },
      { title: 'Cumprir o cronograma de estudos da semana', points: 40, recurrence: 'weekly' },
      { title: 'Levar o cachorro para passear', points: 15, recurrence: 'daily' },
    ],
  },
  {
    label: '15 anos ou mais',
    min: 15,
    max: 99,
    tasks: [
      { title: 'Lavar, estender e recolher a roupa', points: 30, recurrence: 'weekly' },
      { title: 'Cozinhar um prato simples para a família', points: 40, recurrence: 'weekly' },
      { title: 'Fazer uma compra pequena no mercado', points: 25, recurrence: 'weekly' },
      { title: 'Limpar o banheiro', points: 40, recurrence: 'weekly' },
      { title: 'Ajudar um irmão mais novo com a lição', points: 20, recurrence: 'daily' },
    ],
  },
]

export function bandForAge(age: number | null): AgeBand | null {
  if (age == null) return null
  return AGE_BANDS.find((b) => age >= b.min && age <= b.max) ?? null
}
