# ADR-0013 — Máquina de Estados da Interface (Captura)

**Status**: Aceita · **Data**: 2026-08-22

Registro do contrato e comportamento esperado das interfaces de Curadoria.

## Máquina de Estados (`useCaptureStore`)
Existe para desfazer uma ambiguidade que causava perda silenciosa de trilha: `musica === null` significava tanto "ainda estou buscando" quanto "busquei e não achei", e a interface liberava a postagem nos dois casos.
Com o estado nomeado, cada situação tem uma resposta própria:

| Estado | Significado | Ação (Postar) |
|---|---|---|
| `carregando`   | lendo a cena / buscando faixas | Bloqueado, com motivo visível na interface |
| `pronta`       | trilha disponível e aprovada   | Liberado |
| `indisponivel` | terminou sem trilha            | Exige confirmação explícita do usuário |

## "Salvar" versus "Fechar a Folha"
Fechar o `PostSheet` (ou `CaptureSheet`) não zera a sessão (T101). Fechar depois de postar é um gesto frequente para reabrir a edição e mudar o som. A destruição do estado só deve acontecer ao pressionar a ação de "Descartar" explícita na UI (O botão `X`).

## Exportação e Muxing (Background)
Arrastar o slider do recorte ou trocar o Filtro invalida a chave do pacote atual. Esperamos o usuário assentar a escolha em "quietude" antes de dispararmos a pre-geração do .mp4 em segundo plano. Essa tática barateia absurdamente o custo de exportação percebido pelo usuário sem torrar bateria de celular repetindo processos que serão sobrescritos nos próximos 2 segundos.
