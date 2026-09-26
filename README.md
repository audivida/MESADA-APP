# Minha Mesada

App de mesada para a família: os pais criam tarefas com pontos, os filhos enviam uma foto quando terminam, os pais aprovam e os pontos viram mesada.

O nome é provisório. Troque em `src/app/brand.ts`, `index.html` e `public/manifest.webmanifest`.

## O que já funciona

**Responsável**
- Criar conta (com consentimento LGPD) e montar a família, definindo quanto vale 1 ponto.
- Cadastrar filhos com nome, data de nascimento, avatar e PIN de 4 números.
- Criar tarefas diárias, semanais (escolhendo os dias) ou únicas, para todos ou só alguns filhos, com ou sem foto.
- Sugestões de tarefas por idade, com a faixa da sua família em destaque.
- Fila de aprovação com a foto, recados rápidos, aprovar ou pedir para refazer.
- Painel por filho: saldo em pontos e em R$, nível (Bronze, Prata, Ouro, Diamante), tarefas do dia.
- Bônus, desconto de pontos e registro de mesada paga.
- Metas (ex.: “bicicleta nova”) com bônus ao conquistar.
- Extrato completo de cada filho.
- Loja de prêmios: cadastre prêmios (ou use as ideias prontas) e entregue os pedidos dos filhos. Os pontos só saem quando você confirma a entrega.

**Filho ou filha**
- Entra com o código da família e o PIN.
- Vê as tarefas de hoje, tira a foto e envia.
- Acompanha saldo, nível, metas, recados dos pais e extrato.
- Troca pontos por prêmios da loja da família e acompanha os pedidos.
- Trilha no estilo Duolingo: 4 níveis (Bronze, Prata, Ouro, Diamante) com estações, baús surpresa e troféus. Cada estação libera uma dica de educação financeira.
- Sequência de dias seguidos (🔥) e comemoração com confete ao chegar numa estação nova ou subir de nível.

**App**
- Funciona no navegador e pode ser instalado na tela do celular (PWA).
- Tema claro e escuro automáticos.
- Movimento em tudo: telas entrando, listas em cascata, botões que afundam no toque, números que sobem, barras que enchem e confete. Quem ativa “reduzir movimento” no celular vê o app parado.

## Rodar no computador

```bash
npm install
npm run dev
```

Sem configurar nada, o app roda em **modo local**: os dados ficam no navegador. Toque em “Ver uma demonstração” para abrir uma família de exemplo (código `DEMO42`, PINs `1234` da Lia e `4321` do Theo).

## Ligar o servidor (Supabase)

1. Crie um projeto grátis em [supabase.com](https://supabase.com).
2. No painel do projeto, abra **SQL Editor** e rode, em ordem, cada arquivo de `supabase/migrations/` (`0001_init.sql`, depois `0002_rewards.sql`).
3. Em **Authentication → Sign In / Providers**, deixe **Email** ligado e ligue **Allow anonymous sign-ins** (é assim que o filho entra só com código e PIN).
4. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (ficam em **Project Settings → API**).
5. Rode `npm run dev` de novo.

## Publicar

Qualquer hospedagem de site estático serve (Vercel, Netlify, Cloudflare Pages): comando de build `npm run build`, pasta `dist`. Coloque as mesmas variáveis do `.env` nas configurações da hospedagem.

Para as lojas: o caminho mais simples é empacotar este mesmo app com [Capacitor](https://capacitorjs.com) (Android e iPhone).

## Como o código está organizado

| Pasta | O que tem |
|---|---|
| `src/domain` | Regras do negócio: tipos, saldo, níveis, trilha e sequência de dias, tarefa do dia, sugestões por idade |
| `src/data` | Acesso a dados: `localRepo` (navegador) e `supabaseRepo` (servidor), com a mesma interface |
| `src/pages/parent` | Telas do responsável |
| `src/pages/child` | Telas do filho |
| `src/components` | Peças de interface reaproveitadas, trilha (`Trail.tsx`) e animações (`motion.tsx`) |
| `supabase/migrations` | Banco de dados, regras de segurança e funções |
| `supabase/tests` | Teste do banco num Postgres local |

O saldo nunca é um número solto: cada ganho ou gasto é uma linha no extrato, e o saldo é a soma. Isso deixa o histórico auditável.

## Segurança

- Cada família só enxerga os próprios dados (Row Level Security no Supabase).
- Filhos não criam tarefas, não aprovam e não lançam pontos. Pontos só entram pela aprovação dos pais.
- Um pedido de prêmio reserva os pontos, então o filho não gasta o mesmo saldo duas vezes.
- O PIN é guardado com hash e nunca é lido pelo app.
- Fotos ficam num armazenamento privado, com links temporários.

## Testes

```bash
npm test                     # regras e fluxo completo no modo local
./supabase/tests/run.sh      # banco de dados (precisa de um Postgres local)
```

## Próximos passos sugeridos

- Notificações push (“tarefa enviada”, “tarefa aprovada”).
- Cofrinhos gastar / poupar / doar.
- Segundo responsável na mesma família.
- Relatório semanal por e-mail.
- Assinatura (Asaas ou lojas).
