# Documentação de `shareTargets.ts`

Destinos reais de compartilhamento do aparelho (`modules/share-target`).

Mesma postura do `videoMuxer.ts`: o módulo nativo só existe em development
build, então tudo aqui é best-effort. Falhou, não existe, é Expo Go ou é
web → lista vazia, e a interface cai sozinha no botão da folha do sistema,
que é o comportamento que o app já tinha.

Ordem de preferência da grade. Não é uma lista de *quem aparece* — quem
aparece é quem está instalado —, é só quem vai **na frente** quando houver
mais destinos que espaço. Sem isto o `PackageManager` devolveria a ordem
dele, e "Gmail" ou "Arquivos" tomariam o lugar do Instagram na primeira
linha, que é onde os olhos caem.

/** MIME do que de fato vai no Intent: o .mp4 quando existe, senão a imagem. */

/** Preferidos na ordem da lista; o resto depois, preservando a ordem do sistema. */

Ordena em duas faixas — apps preferidos, depois o resto — e faz **rodízio
dentro de cada faixa**, um destino por app antes de repetir qualquer um.

Os dois problemas que isto resolve foram vistos no device, nesta ordem:

1. Um mesmo pacote registra várias activities — o Instagram publica três
(Feed, Stories, Reels). Ordenando só por preferência, ele tomava as três
primeiras vagas e o WhatsApp instalado não aparecia.
2. Corrigido só com "um por app antes de repetir", o tiro saiu pela culatra:
Stories e Reels perderam a vaga para "Adicionar ao Maps" e "Mensagens",
que também recebem `SEND` e não são para onde ninguém posta um pacote
sensorial. Um segundo destino do Instagram vale mais que um primeiro do
Maps — daí o rodízio ser por faixa, e não global.

O resultado é o que se queria, sem hard-code de "Stories": quem declara essas
entradas é o próprio Instagram, e o app só decide a ordem em que cabem.

/** Uma volta por vez: o i-ésimo destino de cada app, na ordem dos apps. */

Abre o destino direto. Devolve `false` quando não deu — e aí quem chamou
deve cair na folha do sistema, em vez de deixar o toque sem resposta.

