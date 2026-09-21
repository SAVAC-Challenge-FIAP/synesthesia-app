# Estado atual — Synesthesia

> **Este arquivo é de atualização obrigatória.** Toda vez que uma feature muda de fase (aberta →
> implementada → validada → mesclada) ou o app ganha uma versão nova, atualize esta página. Ela é
> o único lugar que precisa ser lido para saber "onde estamos" sem abrir `specs/*/ESTADO.md` uma
> por uma.

**Última atualização**: 2026-09-21 · **Versão em produção**: 1.3.1 · **Próxima versão planejada**: 1.4.0 (feature 006)

## Feature ativa

**006 — Foto compartilhada de fora do app**: o app passa a ser destino do "Compartilhar" do
Android (`ACTION_SEND`/`image/*`) e abre a imagem recebida direto na tela de captura, na mesma
sessão de um disparo. Implementada e **validada no device** (as cinco US, incluindo o fluxo real
pela galeria do MIUI) — roteiro e resultado em
[specs/006-foto-compartilhada/ESTADO.md](../specs/006-foto-compartilhada/ESTADO.md). Falta só o
bump de versão/release.

## Linha do tempo das features

| # | Feature | Status | Spec |
|---|---|---|---|
| 001 | Synesthesia MVP | ✅ Concluída | [specs/001-synesthesia-mvp/](../specs/001-synesthesia-mvp/) |
| 002 | QA e lapidação v1 | ✅ Concluída | [specs/002-qa-lapidacao-v1/](../specs/002-qa-lapidacao-v1/) |
| 003 | Looks sugeridos (3 looks + memória de gosto) | ✅ Concluída | [specs/003-looks-sugeridos/](../specs/003-looks-sugeridos/) |
| 004 | QA pós-1.2.0 | ✅ Concluída | [specs/004-qa-pos-1.2.0/](../specs/004-qa-pos-1.2.0/) |
| 005 | Vibe definida pela IA | ✅ Concluída, release 1.3.0 | [specs/005-vibe-pela-ia/](../specs/005-vibe-pela-ia/) |
| — | Acabamento da captura (release 1.3.1) | ✅ Concluída, sem spec formal | — |
| 006 | Foto compartilhada de fora do app | ✅ Implementada e validada no device (2026-09-21) | [specs/006-foto-compartilhada/](../specs/006-foto-compartilhada/) |

Detalhe de progresso task-a-task de cada feature vive no `tasks.md`/`ESTADO.md` da própria pasta em
`specs/`. Esta tabela é só o resumo de "em que fase está".

## O que o app faz hoje (resumo)

- Visor com filtro ao vivo (8 presets locais, piso de degradação) e detecção de vibe on-device.
- Foto também entra **de fora**: compartilhar uma imagem de outro app (Android) abre a tela de
  captura com ela, com a mesma curadoria do disparo (feature 006).
- Ao capturar: Gemini lê a foto + hora + localização (opt-in) e devolve vibe livre (texto, ≤2
  palavras), 3 looks sugeridos e até 4 sugestões de música (Deezer resolve os previews de 30s).
- Gosto (música e tratamento visual) é lembrado como lista das 20 últimas escolhas e entra no
  prompt do Gemini.
- Captura vira pacote sensorial (imagem + filtro + trilha) exportado como `.mp4` único via
  `modules/video-muxer` (Media3 Transformer) em dev build; degrada para imagem + áudio + legenda
  fora dele.
- Galeria local persistente, editável, com emoji/vibe por card.
- Captura mira ~12 MP (`escolherTamanhoNativo`) em vez da maior resolução do sensor: o disparo caiu
  de 3534ms para 664ms medidos no Redmi. Resolução não é mais escolha do usuário — o seletor saiu
  da barra da câmera.
- No modal de captura a foto ocupa 100% da largura (altura livre pelo aspecto real), tem botão de
  girar 90° (`FotoEditavel` → `aplicarTransformacao`, que troca `session.photoUri`) e ganha uma
  seta de rolagem só em fotos altas (aspecto ≤ 0.65).

## Decisões-pilar

Princípios inegociáveis: [.specify/memory/constitution.md](../.specify/memory/constitution.md).
Decisões técnicas específicas (não-pilar, mas registradas para não se perder): [docs/adr/](./adr/).

## Mapa da documentação

- **[adr/](./adr/)** — decisões técnicas específicas que atravessam mais de um arquivo, numeradas.
- **[components/](./components/)** — um `.md` por arquivo de código-fonte (`.ts`/`.tsx`) que tinha
  comentários explicativos; cada arquivo de código aponta para o seu par via `@docs` no topo.
  Espelho 1:1 do que antes vivia como comentário inline.
- **[research/](./research/)** — material-fonte (specs originais do MVP em Python, pesquisa de
  mercado/modelos, métricas/limiares).
- **[rules/](./rules/)** — regras de processo e convenção que não vivem no código (comentários,
  segredos).
- **[runbooks/](./runbooks/)** — como fazer: configurar ambiente, testar no device, publicar
  release, armadilhas técnicas conhecidas.
- **[previews/](./previews/)** — capturas de tela da versão em produção. Uma pasta por versão;
  versões antigas não se acumulam, só a atual é mantida.
- **[_archive/](./_archive/)** — documentos obsoletos, mantidos só por histórico.

## Próximos passos

- **Release 1.3.1** — ajustes de layout e bugs simples que o Sávio notou no uso; ainda não
  especificados formalmente. Abrir como feature/QA quando os itens estiverem listados.
- Ao abrir uma feature nova, criar `specs/00N-nome/` via `/speckit-specify` e atualizar a tabela
  acima.

## Reorganização de 2026-08-22 (esta sessão)

`docs/` foi reestruturado do zero (era um único diretório com previews acumuladas por fase,
85MB+): agora segue `adr/ | components/ | research/ | rules/ | runbooks/ | previews/ | _archive/`,
com `ESTADO.md` como índice central. Mudanças que valem saber:

- **Chave de assinatura movida para `keys/`** na raiz do projeto — dentro do repositório, mas fora
  do git e fora do que o build lê diretamente. Ver
  [chaves-e-segredos.md](./rules/chaves-e-segredos.md). Motivo: uma sessão anterior perdeu a chave
  de assinatura porque ela só existia em `~/Documents/`, fora da visão do projeto; `preparar-release.py`
  gerava uma chave nova silenciosamente quando não achava uma — isso foi corrigido para falhar alto
  em vez de gerar.
- **`scripts/dev-android.sh` não tem mais IP hardcoded** — config pessoal em
  `scripts/dev-android.local.sh` (gitignored), copiado de `dev-android.local.sh.example`
  (versionado). `scripts/gerar-icones.py` foi removido (gerou os ícones atuais, mas não é mais
  necessário mantê-lo — os PNGs em `assets/` já existem).
- **Regra nova**: proibido comentário em código-fonte (constitution, emenda 1.3.0). Ver
  [rules/codigo.md](./rules/codigo.md). **Aplicada**: os 52 arquivos que tinham comentários foram
  limpos (por uma sessão de IA separada, seguindo um prompt estruturado) — o conteúdo virou
  `docs/components/*.md` (1:1) e alguns ADRs temáticos novos (0003–0013) para decisões que
  atravessam múltiplos arquivos.
- **Processo de release documentado passo a passo** em
  [runbooks/build-e-deploy.md](./runbooks/build-e-deploy.md) — sem EAS, do bump de versão até o
  GitHub Release.
- **Previews completas**: as 6 telas principais (Câmera, Captura, Trocar Música, Ajustes, Galeria,
  Confirmação de Postagem) capturadas em device real na versão 1.3.0, em
  [previews/1.3.0/](./previews/1.3.0/).
