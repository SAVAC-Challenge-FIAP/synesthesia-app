# Ativar a curadoria musical com Gemini

O Synesthesia usa o **Gemini** (Google) para curar até 4 músicas coerentes com a "vibe" da foto, com justificativas em pt-BR. O Deezer depois resolve o preview de 30s de cada faixa.

> **É opcional.** Sem a chave, o app funciona igual: cai direto no Deezer (busca por palavras-chave da vibe) e, sem internet, no catálogo local. Nenhuma foto é perdida por falta de chave.

Referência no código: `src/services/music.ts` (função `askGemini`, linha ~39). A chave é lida de `process.env.EXPO_PUBLIC_GEMINI_API_KEY`.

---

## Passo 1 — Pegar a chave (grátis)

1. Acesse **https://aistudio.google.com/app/apikey** (Google AI Studio).
2. Faça login com sua conta Google.
3. Clique em **"Create API key"** / **"Criar chave de API"**.
4. Escolha (ou deixe criar) um projeto do Google Cloud quando pedir.
5. Copie a chave gerada — algo como `AIzaSy...`. **Guarde com cuidado: é um segredo.**

> O tier gratuito do Google AI Studio cobre folgadamente o uso de demonstração do app. Não precisa cadastrar cartão para o free tier.

## Passo 2 — Colocar a chave no projeto

Na raiz do projeto (`synesthesia-app/`):

1. Copie o modelo para um `.env` real:
   ```bash
   cp .env.example .env
   ```
   (No Windows/PowerShell: `Copy-Item .env.example .env`)

2. Abra o `.env` e cole a chave:
   ```env
   EXPO_PUBLIC_GEMINI_API_KEY=AIzaSyCOLE_SUA_CHAVE_AQUI
   ```

3. **Não commite o `.env`.** Ele já está no `.gitignore` (regra `.env`), então o Git o ignora automaticamente. Só o `.env.example` (sem valor) vai para o repositório.

## Passo 3 — Reiniciar o Expo com cache limpo

Variáveis `EXPO_PUBLIC_*` são embutidas no bundle na inicialização — mudar o `.env` exige reiniciar:

```bash
npx expo start -c
```

O `-c` limpa o cache do Metro para garantir que a nova variável seja lida.

## Passo 4 — Confirmar que ativou

1. Tire uma foto no app e abra o modal de captura.
2. Enquanto a trilha é curada, aparece "CURANDO A TRILHA DA SUA VIBE...".
3. Com o Gemini ativo, as **justificativas** das músicas são frases geradas por IA (ex.: contextuais à vibe), e a origem interna passa a ser `gemini`. Sem a chave, a justificativa é o texto genérico "Combina com a atmosfera ... da cena" (origem `deezer`).

---

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Justificativas continuam genéricas | Chave não carregou | Confirme que o arquivo é `.env` (não `.env.txt`), que a linha é `EXPO_PUBLIC_GEMINI_API_KEY=...` sem espaços, e rode `npx expo start -c` |
| Erro 400/403 do Gemini | Chave inválida ou API não habilitada | Gere a chave de novo no AI Studio; confirme que a "Generative Language API" está habilitada no projeto |
| Erro 429 | Estourou a cota gratuita | Aguarde a janela de cota resetar; o app cai no Deezer automaticamente enquanto isso |
| Sem música nenhuma | Sem internet | Esperado: entra o catálogo local (offline). A foto nunca se perde. |

## Segurança

- `EXPO_PUBLIC_*` fica **embutida no bundle do app** — em produção, qualquer um que extraia o app pode ler a chave. Para o MVP de demonstração (JOVI Challenge) isso é aceitável; para produção real, a curadoria deveria passar por um backend/proxy que guarda a chave no servidor.
- Nunca cole a chave direto no código nem em `app.json` versionado — sempre no `.env` (ignorado pelo Git).
