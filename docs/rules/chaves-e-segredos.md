# Chaves e segredos — onde cada uma vive

Nenhuma chave, senha ou keystore é commitada neste repositório. Este documento existe para que
nenhuma delas se perca — se este arquivo ficar desatualizado, a chave real pode virar
irrecuperável.

## Keystore de assinatura Android (release)

| | |
|---|---|
| Arquivos | `synesthesia-release.keystore`, `keystore.properties` |
| **Cofre canônico** | `keys/` na raiz deste repositório — **dentro da pasta do projeto, fora do git** (`/keys/` no `.gitignore`) e fora do que o build lê diretamente |
| Local de trabalho (lido pelo build) | `android/app/synesthesia-release.keystore`, `android/keystore.properties` — `scripts/preparar-release.py` copia de `keys/` para cá a cada release |
| Backup externo | `~/Documents/synesthesia-chaves/` (fora deste repositório, na máquina do Sávio) — mesma cópia, redundância caso `keys/` seja apagado por acidente |
| Se perder | Impossível atualizar o app já publicado sob a mesma identidade — precisaria republicar como app novo |

**Por que dentro do repo**: um keystore só em `~/Documents/` (fora da pasta do projeto) é fácil de
esquecer que existe — foi assim que uma sessão anterior rodou `preparar-release.py` sem ele
presente e o script antigo gerou uma chave **nova**, silenciosamente, o que teria invalidado
atualizações do app publicado se o problema não tivesse sido pego a tempo. `keys/` fica visível
dentro do projeto (ninguém esquece que a pasta existe) mas nunca é rastreado pelo git nem lido
diretamente pelo `build.gradle` — só `scripts/preparar-release.py` o toca, e apenas para copiar.

**Regra**: `scripts/preparar-release.py` **falha alto** se `keys/synesthesia-release.keystore` ou
`keys/keystore.properties` não existirem — nunca gera uma chave nova sozinho. Se `keys/` for
perdido, restaure a partir de `~/Documents/synesthesia-chaves/` antes de rodar qualquer release.
Uma máquina nova (clone do repositório) precisa desses dois arquivos colocados manualmente em
`keys/` antes do primeiro release — não existe forma automática de obtê-los, de propósito.

## Chave de API do Gemini

| | |
|---|---|
| Variável | `EXPO_PUBLIC_GEMINI_API_KEY` |
| Onde vive | `.env` (raiz do projeto), fora do git — copiar de `.env.example` |
| Como obter | [runbooks/configurar-gemini.md](../runbooks/configurar-gemini.md) |
| Se ausente | Degradação graciosa: cai para Deezer puro, depois catálogo local — nunca bloqueia |

## Regra geral

Ver Princípio IV da [constitution](../../.specify/memory/constitution.md): nenhuma chave de API ou
dado pessoal é commitado. Antes de `git add`, revisar o que entrou (`git status`) sempre que um
arquivo novo de configuração for tocado.
