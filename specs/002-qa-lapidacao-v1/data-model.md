# Data Model — QA e Lapidação do MVP v1

**Feature**: `002-qa-lapidacao-v1` | **Date**: 2026-08-15

Esta feature **não cria entidades novas**. Ela torna **explícito** um estado que hoje existe de forma implícita e é justamente a origem do defeito P1 da US2.

---

## Entidade: Estado da Curadoria

Hoje o app deriva "tem música ou não" de `session.musica` ser `null`. Esse booleano é ambíguo: `null` significa tanto **"ainda estou buscando"** quanto **"busquei e não achei"** — e é essa ambiguidade que faz a interface liberar a postagem cedo demais.

### Estados

| Estado | Significado | Postar | Salvar |
|---|---|---|---|
| `ocioso` | Nenhuma captura ativa | — | — |
| `carregando` | Lendo a cena / buscando faixas | ❌ Bloqueado, com motivo visível | ✅ Sempre |
| `pronta` | Trilha disponível e aprovada | ✅ Liberado | ✅ Sempre |
| `indisponivel` | Curadoria terminou sem trilha | ⚠️ Exige confirmação explícita | ✅ Sempre |

### Transições

```
ocioso ──(captura)──> carregando
carregando ──(trilha resolvida)──> pronta
carregando ──(falha / sem resultado / tempo limite)──> indisponivel
pronta ──(usuário troca a música)──> carregando
indisponivel ──(usuário tenta de novo)──> carregando
qualquer ──(descartar)──> ocioso
```

### Regras de validação

- **RV-01**: A ação de postar só é acionável no estado `pronta`, ou em `indisponivel` **após confirmação explícita** do usuário.
- **RV-02**: A ação de salvar é acionável em **todos** os estados — a foto nunca pode ser perdida nem bloqueada (Princípio V).
- **RV-03**: Nenhuma mensagem de conclusão pode afirmar que o pacote está pronto sem declarar o que ele contém.
- **RV-04**: O estado `carregando` MUST comunicar progresso — não pode ser um texto estático por 30–45s.

---

## Entidade: Progresso da Exportação

Também implícito hoje: o módulo nativo só reporta início (chamada) e fim (Promise resolvida). A informação intermediária existe na biblioteca, mas é descartada.

### Campos

| Campo | Tipo | Descrição |
|---|---|---|
| `progresso` | número 0–100 | Percentual concluído da exportação |
| `estado` | `iniciando` \| `exportando` \| `concluido` \| `falhou` | Fase atual |

### Regras de validação

- **RV-05**: O progresso reportado MUST ser proporcional ao trabalho concluído, nunca estimado por tempo decorrido.
- **RV-06**: A interface MUST permanecer responsiva durante toda a exportação.
- **RV-07**: Falha na exportação **não** pode impedir o compartilhamento do pacote degradado (imagem + áudio + legenda) — comportamento já existente no v1 que não pode regredir (FR-Q16).

---

## Entidades inalteradas

`Media`, `MusicSuggestion`, `Vibe`, `Filtro` e `SharePackage` permanecem **exatamente** como estão no v1. Nenhum campo é adicionado, removido ou renomeado — o pacote exportado precisa continuar idêntico ao já validado (FR-Q16, SC-Q07).
