# CLAUDE.md — Synesthesia

Guia para agentes de código (Claude Code) trabalharem neste repositório. Leia isto antes de gerar ou alterar código.

## O que é o Synesthesia

App mobile de câmera **multimodal e contextual** para o **JOVI Challenge — FIAP 2026** (equipe SAVAC). Ele traduz automaticamente o *contexto visual* de uma foto em **filtros** e **trilha sonora** harmônicos, reduzindo o "atrito de decisão" na criação de conteúdo para redes sociais. Público-alvo: estudantes em tempo integral / geração jovem.

Três pilares:
1. **Inteligência Contextual e Adaptativa** — a "vibe" do visor é recalculada em tempo real (inclusive ao virar a câmera frontal/traseira) e o filtro correspondente é aplicado ao vivo.
2. **Fusão entre Atmosfera e Som** — imagem + música formam um único "pacote sensorial"; ao capturar, o sistema sugere trilhas coerentes com a atmosfera.
3. **Ciclo de Vida da Mídia e Memória Persistente** — cada registro é editável e permanente; galeria inteligente permite revisitar, lapidar e exportar.

> A entrega de Python (Sprint 2 — Computational Thinking) foi um **MVP funcional em terminal** (menus numéricos, dados em `filtros.json`/`musicas.json`/`galeria.json`). **Este repositório é a evolução mobile** dessa prova de conceito em React Native/Expo. Os documentos-fonte de requisitos e arquitetura estão em [`docs/research/`](docs/research/) — consulte-os como fonte de verdade do produto.

## Por onde começar

**Antes de tocar em código, leia [`docs/ESTADO.md`](docs/ESTADO.md)** — é o índice de estado atual
do projeto (feature ativa, versão em produção, o que falta). Mapa completo da documentação:

- [`docs/adr/`](docs/adr/) — decisões técnicas que atravessam mais de um arquivo, numeradas.
- [`docs/components/`](docs/components/) — um `.md` por arquivo de código com o que antes era
  comentário inline; o arquivo de código aponta pro seu par via `@docs` no topo.
- [`docs/research/`](docs/research/) — material-fonte (specs do MVP em Python).
- [`docs/rules/`](docs/rules/) — regras de processo (código, segredos).
- [`docs/runbooks/`](docs/runbooks/) — como fazer: device, build/deploy, armadilhas conhecidas.
- [`specs/`](specs/) — Spec Kit: uma pasta por feature, com sua própria spec/plan/tasks.

## Stack técnica (definida no doc de arquitetura)

| Camada | Tecnologias |
|---|---|
| **App / navegação** | Expo, `expo-router`, TypeScript |
| **Câmera** | `expo-camera` (CameraX no Android) |
| **Estado / persistência** | `zustand`, `@react-native-async-storage/async-storage` |
| **Leitura da cena** | Gemini (`gemini-3.1-flash-lite`) via REST, na **captura** — ver "IA visual on-device" abaixo |
| **Curadoria musical** | Mesma chamada do Gemini + **Deezer API** (previews de 30s) |
| **Filtros / render** | `@shopify/react-native-skia`, `react-native-reanimated` |
| **Edição** | `@react-native-community/slider`, `expo-audio` |
| **Contexto** | `expo-location` (opt-in duplo: flag nos ajustes + permissão) |
| **Geração de vídeo** | `modules/video-muxer` local (Media3 Transformer → `.mp4` H.264+AAC) |
| **Entrada por compartilhamento** | `modules/share-intake` local (`ACTION_SEND` de outro app → tela de captura) |
| **Saída** | `expo-media-library` (salvar), `expo-sharing` (share intent nativo) |

Regras de stack:
- **Não** adicione Tailwind. O design gerado pelo Figma vem em React+Tailwind — **converta** para `StyleSheet` do React Native usando os tokens abaixo.
- Toda leitura de cena por IA acontece **na captura**, custa uma chamada de rede e é orçada em 22s
  (`LIMITE_GEMINI_MS`). Sem rede ou sem chave, degrada para os 8 presets locais.
- Chaves de API vivem em variáveis de ambiente, nunca commitadas.

### IA visual on-device — não implementado, estudo para v2

Versões anteriores deste arquivo listavam `react-native-mlkit-image-labeling` como se estivesse
em uso. **Não está**: não é dependência do `package.json` e não é importado em lugar nenhum de
`src/`. Nenhuma análise de imagem roda no aparelho hoje.

O que o visor faz de fato ([`src/services/vibeEngine.ts`](src/services/vibeEngine.ts)) é escolher
um clima de forma **determinística, por hora do dia + câmera frontal/traseira** — sem olhar um
pixel. A leitura real da cena vem do Gemini, no disparo.

Rodar um modelo embarcado (ML Kit ou equivalente) fica como **estudo para a v2**. O ganho seria
leitura de cena sem rede, sem latência e sem a foto sair do aparelho — que é justamente o
argumento mais forte numa integração com uma fabricante. Quem for implementar começa por aqui;
até lá, **não afirme "on-device" em pitch, slide ou documentação**.

O único dado que de fato nunca sai do aparelho hoje é o **histórico de gosto**
(`useLookTasteStore` / `useTasteStore`, últimas 20 escolhas em AsyncStorage).

## Identidade visual (design tokens)

Fonte da verdade: Figma `JOVI-Challenge---FIAP-2026` + `kite_camera_style_guide.html`.

**Cores**
| Token | Hex | Uso |
|---|---|---|
| `ruby` | `#8D1514` | Primária — CTAs, toggles ativos, badges |
| `amber` | `#F8A20D` | Acento — música, foco, valores mono destacados |
| `ink` | `#090506` | Fundo base (quase preto) |
| `parchment` | `#F5EEDE` | Texto/ícones sobre fundo escuro |
| `parchment/25` | `rgba(245,238,222,0.25)` | Home bar, divisores |

Fundo da câmera: gradiente `linear-gradient(180deg, rgba(141,21,20,0.5) 0%, rgba(39,6,6,0.25) 100%)` sobre `#090506`.
Modais claros (permissões, compartilhar, música): superfície `parchment` com texto `ink`.

**Tipografia**
- **Nunito** (700 Bold) — títulos/display (ex.: "Ajustes.").
- **Lato** (300 Light / 400 Regular / 700 Bold) — labels técnicas, status bar, seções, metadados, chips de filtro.

> **Mudou em 2026-08-15** (T046, decisão do Sávio): antes eram **Syne** (display) e **DM Mono**
> (labels). O Figma e o `kite_camera_style_guide.html` ainda mostram as antigas — **o código e
> este arquivo é que valem**. Lato não é monoespaçada, então as labels perderam o caráter de
> máquina do DM Mono; o que as mantém "técnicas" é a caixa alta com `letterSpacing`.
> Os tokens em `src/theme/tokens.ts` nomeiam a **função**, não a fonte:
> `display`, `labelLight`, `label`, `labelForte`.

**Raios/medidas** — chips de filtro `border-radius: 15px`; cards/modais `~10–16px`; botão de captura círculo 70px; frame de foto aspecto ~735/913.

**8 filtros (nome + emoji):** Vivid 🌟 · Neon 🌈 · Love ❤️ · Eclipse 🌒 · Retro 📼 · Vintage 🧡 · Arctic ❄️ · Honey 🍯.

## Telas e modais (do Figma)

1. **Permissões** — onboarding: pede câmera 📸 e galeria 🏞️; "Permitir tudo". Enfatiza processamento local.
2. **Câmera** — visor com filtro ao vivo, carrossel de 8 filtros, galeria / captura / flip, "+ Opções" (→ Ajustes).
> **Entrada por fora (feature 006, 2026-09-21)**: a foto não precisa vir do disparo. O app é
> destino de `ACTION_SEND`/`image/*` no Android — compartilhar uma imagem de qualquer app cai
> direto na tela de captura, com a mesma sessão de um disparo (curadoria, looks, trilha, salvar,
> postar). Quem lê o intent é `modules/share-intake`; o porquê de ser código nativo está em
> [`docs/adr/0014-entrada-por-compartilhamento.md`](docs/adr/0014-entrada-por-compartilhamento.md).
> **Android apenas** — o app é 100% Android por decisão de produto; não há versão iOS planejada.

3. **Modal Captura** (bottom-sheet) — foto capturada, três looks sugeridos, carrossel dos 8 presets, player de música (slider 0–30s com trecho), "Trocar música", ações **Salvar** / **Postar agora**.

> **Mudou em 2026-08-19** (feature 003, `specs/003-looks-sugeridos/`): a tabela fixa
> `vibe → filtro` que escolhia um único tratamento por conta própria virou **três looks
> sugeridos por foto** (papéis `certeira`/`ousada`/`afinidade`), lidos pelo Gemini na
> mesma chamada que já cura a música — sem chamada de rede nova. O primeiro é aplicado
> sozinho; os outros dois ficam a um toque. O app aprende o gosto visual do aparelho
> (`useLookTasteStore`) e, com sinal suficiente, a sugestão principal passa a vir do
> histórico local, nunca do prompt do Gemini (`FR-014`). A tabela `vibe → filtro`
> continua viva como piso de degradação (sem rede/chave) e como o que o **visor ao
> vivo** usa — ele segue nos 8 presets locais, sem depender desta feature (`FR-021`).
> Render fiel da foto final (Skia, paridade Android/iOS) é carga opcional: funciona sem
> rebuild nativo, caindo para o render antigo (`style.filter` do RN) até o dev build
> ser regerado com `@shopify/react-native-skia` dentro.
4. **Modal Trocar Música** (bottom-sheet claro) — "Escolha a vibe sonora", 3–4 sugestões do Gemini (emoji + título + artista + justificativa + play), Cancelar / Confirmar escolha.
5. **Confirmação de Postagem** — "Vídeo gerado!", grade de destinos (Instagram, TikTok, WhatsApp, LinkedIn, X/Twitter, Mais), Fechar.
6. **Ajustes** — seções CÂMERA (Filtro automático, Detecção em tempo real / ML Kit, Grade de composição) e MÚSICA (Sugestão automática / Gemini, Fonte do áudio: DEEZER); toggles ruby.

## Fluxo de spec-kit

Este repo usa **Spec Kit**. Artefatos e ordem:
- `.specify/memory/constitution.md` — princípios inegociáveis do projeto.
- `specs/001-synesthesia-mvp/spec.md` — especificação (User Stories US01–US11 → priorizadas).
- `specs/001-synesthesia-mvp/plan.md` — plano técnico (gerar via `/speckit-plan`).
- `specs/002-qa-lapidacao-v1/` — QA e lapidação pós-MVP.
- `specs/003-looks-sugeridos/` — três looks sugeridos com memória de gosto (ver nota acima); `ESTADO.md` registra onde a implementação parou entre sessões.
- `specs/006-foto-compartilhada/` — entrada por `ACTION_SEND`; o `ESTADO.md` traz o roteiro de teste no device e a armadilha do dev client no cold start.
- Skills disponíveis: `/speckit-specify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-implement`, `/speckit-clarify`, `/speckit-analyze`, `/speckit-checklist`, `/speckit-converge`.

Ao implementar uma feature, siga a spec e o plano correspondentes; a constitution prevalece sobre preferências pontuais.

## Convenções de código

- TypeScript estrito; componentes funcionais + hooks.
- Navegação por arquivos com `expo-router` (`app/`).
- Estado global em `zustand` stores (`src/stores/`); nada de estado sensorial (vibe/mídia em edição) espalhado em componentes.
- Textos de UI em **pt-BR** (o produto é pt-BR).
- Commits em pt-BR, no imperativo. Não commitar `.env`, chaves, nem `node_modules`.
- **Proibido comentário em código-fonte** (`.ts`/`.tsx`) — nem os que explicam uma invariante
  não-óbvia. Toda explicação de decisão vai para um `.md` (ADR, `ESTADO.md` da spec ativa, ou
  `docs/rules/`). Ver [`docs/rules/codigo.md`](docs/rules/codigo.md) para o porquê.
- Segredos e onde cada chave vive de fato: [`docs/rules/chaves-e-segredos.md`](docs/rules/chaves-e-segredos.md).

<!-- SPECKIT START -->
## Feature ativa

**006 — Foto compartilhada de fora do app** (`specs/006-foto-compartilhada/`): o Synesthesia vira
destino do "Compartilhar" do Android e abre a foto recebida direto na tela de captura. Ver
[`docs/ESTADO.md`](docs/ESTADO.md) para a linha do tempo completa e o resumo do que o app faz hoje.
<!-- SPECKIT END -->
