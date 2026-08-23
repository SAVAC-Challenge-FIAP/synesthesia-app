# Documentação de `mediaStorage.ts`

Persistência física das fotos: copia do cache da câmera para o
documentDirectory, garantindo que a mídia sobreviva entre sessões (FR-011).

/** Copia a foto capturada para armazenamento permanente e retorna a URI nova. */

Baixa a prévia de 30s da faixa para o armazenamento permanente e devolve a
URI local (T102).

O `downloadAudioPreview` de `sharePackage.ts` grava em `Paths.cache`, e cache
é apagável pelo sistema a qualquer momento — serve para o share intent, que
consome o arquivo em seguida, mas não para o registro da galeria, que precisa
durar (Pilar 3 / FR-011). Por isso o áudio do momento mora ao lado da foto,
em `documentDirectory/galeria/`, e é apagado junto com ela.

Best-effort: sem `previewUrl`, sem rede ou com o disco cheio devolve `null` e
a mídia é salva sem áudio local — o player degrada para a URL remota em vez
de bloquear o salvamento.

Prévia de uma faixa **candidata**, no cache (T106).

Diferente de `persistAudioPreview`: a trilha escolhida é parte do momento e
mora no `documentDirectory`, permanente. As outras três sugestões são
material de decisão — se o sistema as limpar, nada se perde, e voltar a
baixá-las é barato. Por isso `Paths.cache`, que é exatamente o lugar de algo
reconstituível.

Devolve a URI local, ou `null` em qualquer falha (sem rede, disco cheio).

Caminho que uma candidata **teria** no cache, se já tiver sido baixada.

Consulta síncrona e sem rede: é o que o player usa para decidir, no momento
do toque, se toca do disco ou cai para a URL remota.

/** Remove o arquivo físico da foto (exclusão permanente — FR-012). */

Remove o .mp3 local da trilha (T102). Mesma tolerância do `deletePhoto`:
o registro manda, o arquivo é consequência.

