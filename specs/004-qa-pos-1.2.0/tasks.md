# QA pós-1.2.0 — bugs encontrados no uso real

**Aberto em**: 2026-08-22 · **Branch base**: `claude/current-filter-system-6gpmbh`
**Relatados por**: Sávio, usando o app depois do release 1.2.0.

Dois bugs, ambos reproduzidos por uso real e com a causa já localizada no
código. O T101 é o mais grave: destrói trabalho do usuário.

---

## T101 — Fechar a publicação descarta o momento

**Prioridade: alta.** É perda de trabalho, não incômodo.

### O que acontece

Tocar em **Postar agora** → **Fechar** não volta para onde a pessoa estava:

| De onde publicou | Esperado ao fechar | O que acontece hoje |
|---|---|---|
| Modal de Captura | volta ao modal, com a foto e as escolhas intactas | **cai na câmera; o momento é descartado** |
| Galeria (mídia reaberta) | volta à mídia aberta | volta à galeria |

Fechar a folha de compartilhamento é o gesto de quem **mudou de ideia** — quer
trocar o look, a música, o trecho. Hoje esse gesto apaga tudo: a foto capturada,
o look escolhido, a trilha curada. Quem publicou a partir da captura perde o
momento inteiro e precisa fotografar de novo.

### Causa

`src/components/CaptureSheet.tsx`, no `onClose` do `PostSheet` (~linha 912):

```tsx
onClose={() => {
  setSharePkg(null);
  clear();          // <- limpa a sessão inteira
}}
```

`clear()` zera a `CaptureSession`. Sem sessão, o `CaptureSheet` desmonta e a
navegação cai para a tela de baixo. O `setSharePkg(null)` sozinho já fecharia
a folha — o `clear()` é que causa o dano.

### Como deve ficar

Fechar a folha fecha **só a folha**. A sessão continua viva e a pessoa volta
exatamente ao que estava editando, podendo publicar de novo sem refazer nada.

Atenção ao decidir onde o `clear()` deve viver: ele ainda precisa acontecer
quando a pessoa **conclui** o fluxo (fecha a captura pelo X, ou salva). Ver o
`salvar(true)` e o botão de fechar do `CaptureSheet` antes de mover a chamada.

### Como verificar (device)

1. Capturar → **Postar agora** → esperar o pacote → **Fechar**
   → deve voltar ao modal de Captura com foto, look e trilha intactos
2. No mesmo modal, tocar em **Postar agora** de novo → deve funcionar
3. Reabrir uma mídia pela galeria → **Postar agora** → **Fechar**
   → deve voltar à mídia aberta, não à lista
4. Fechar a captura pelo **X** → aí sim a sessão termina (comportamento atual,
   não deve regredir)

---

## T102 — Música não toca em mídia reaberta pela galeria

**Prioridade: média.** Não destrói nada, mas quebra a promessa do produto:
o momento é "foto + trilha", e metade dele não volta.

### O que acontece

Abrir um momento salvo pela galeria: às vezes o player fica **carregando para
sempre**, às vezes carrega mas o **play não toca**. Intermitente entre mídias e
entre tentativas na mesma mídia.

### Causa

`MusicPlayer.tsx:55` toca `musica.previewUrl` — uma **URL remota do Deezer**,
não um arquivo local:

```tsx
const player = useAudioPlayer(musica.previewUrl);
```

O que a galeria persiste em `Media.musica` é só essa URL. Ela é um link de
preview do Deezer: **expira** e depende de rede a cada reabertura. Daí o
comportamento intermitente — mídia recente ainda toca, mídia de dias atrás não.

Já existe `downloadAudioPreview` (`src/services/sharePackage.ts:80`), mas ele
só roda na **exportação**, e o arquivo baixado não é guardado no registro.

### Caminhos possíveis (decisão de quem implementar)

1. **Baixar o preview ao salvar** e guardar o caminho local em `Media`
   (campo novo, aditivo, tipo `audioUri?: string`). Reabrir toca do disco, sem
   rede. Custo: ~1 MB por momento e um campo novo no modelo.
2. **Revalidar ao reabrir**: se a URL falhar, buscar de novo no Deezer pelo
   título+artista já salvos. Não gasta disco, mas precisa de rede e pode não
   achar a mesma faixa.
3. **Assumir e comunicar**: manter como está e mostrar no player que a prévia
   expirou, com ação de recarregar. É o mais barato e o menos bom.

Sugestão: **(1)**, com degradação para (3) quando o download falhar. É o único
que cumpre "o momento é permanente" (Pilar 3) sem depender de rede.

### Cuidados

- `Media` é persistida; qualquer campo novo tem de ser **opcional**, e mídias
  antigas precisam abrir sem ele (mesma regra de `aspecto` e `sugestoes`)
- faixa sem `previewUrl` já existe hoje e aparece com o play apagado —
  esse caminho não deve regredir
- ver `FR-011` (permanência) e o tratamento de `sugestoes` em `gallery.tsx`
  como precedente de campo aditivo

### Como verificar (device)

1. Salvar um momento com trilha → fechar o app → reabrir pela galeria
   → o play tem de funcionar
2. Repetir com o **Wi-Fi desligado** → se a opção (1) for a escolhida, tem de
   tocar mesmo offline
3. Reabrir uma mídia salva **antes** desta correção → tem de abrir sem erro,
   com o play apagado ou recarregando, nunca travado em "carregando"
4. Momento salvo com a trilha arquivada → segue sem player, como hoje

---

## Fora de escopo

Não mexer em: carrossel de tratamentos, seletor de resolução, fluxo de salvar,
render por Skia. Estão validados no device e no release 1.2.0.
