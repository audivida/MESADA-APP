/** Troque aqui o nome do app. */
export const APP_NAME = 'Minha Mesada'

export const AVATARS = ['🦊', '🐢', '🐼', '🦄', '🐯', '🐸', '🐙', '🦁', '🐰', '🐨', '🚀', '⚽']

export const REWARD_ICONS = ['🎁', '📱', '🎮', '🍕', '🍦', '🎬', '🌳', '🧸', '📚', '⚽', '🛝', '🎨', '🍧', '🎒', '👕', '🎣', '✈️']

/** Ideias para a loja de prêmios começar cheia. */
export const REWARD_IDEAS = [
  { title: '30 minutos a mais de tela', icon: '📱', costPoints: 40 },
  { title: 'Escolher o jantar', icon: '🍕', costPoints: 60 },
  { title: 'Sorvete no fim de semana', icon: '🍦', costPoints: 50 },
  { title: 'Noite de cinema em casa, com pipoca', icon: '🎬', costPoints: 80 },
  { title: 'Dormir 30 minutos mais tarde', icon: '🌙', costPoints: 50 },
  { title: 'Passeio escolhido por você', icon: '🌳', costPoints: 150 },
  { title: 'Açaí', icon: '🍧', costPoints: 30, limitCount: 1, limitPeriod: 'week' as const },
  { title: 'Acessório novo', icon: '🎒', costPoints: 80, limitCount: 1, limitPeriod: 'month' as const },
  { title: 'Roupa nova', icon: '👕', costPoints: 120, limitCount: 1, limitPeriod: 'month' as const },
  { title: 'Pescaria', icon: '🎣', costPoints: 200, limitCount: 1, limitPeriod: 'month' as const },
  { title: 'Viagem em família', icon: '✈️', costPoints: 1400, limitCount: 2, limitPeriod: 'year' as const },
]

/** Atalhos de bônus e desconto no painel do filho. */
export const QUICK_ACTIONS = [
  { label: 'Palavras mágicas', icon: '✨', points: 20, kind: 'bonus' as const },
  { label: 'Ajudou alguém', icon: '🤝', points: 20, kind: 'bonus' as const },
  { label: 'Dividiu com o irmão', icon: '🫶', points: 10, kind: 'bonus' as const },
  { label: 'Falta de educação', icon: '😤', points: 20, kind: 'penalty' as const },
  { label: 'Briga', icon: '🥊', points: 20, kind: 'penalty' as const },
]

/** Ideias de elogio para quem não sabe por onde começar. */
export const PRAISE_IDEAS = ['Obrigado pela ajuda!', 'Você foi muito gentil hoje', 'Mandou bem na escola!', 'Adorei a sua atitude']
