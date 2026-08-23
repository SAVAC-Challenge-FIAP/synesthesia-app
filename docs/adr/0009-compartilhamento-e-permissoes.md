# ADR-0009 — Compartilhamento de Mídia e Permissões Best-Effort

**Status**: Aceita · **Data**: 2026-08-22

## Permissão de Localização
A permissão de localização no Android (e iOS) nunca deve quebrar o app se recusada, pois é usada estritamente de maneira não essencial. Se formos negados, a captura segue normalmente, mas gravamos uma "Cidade Desconhecida" no lugar, garantindo a "degradação graciosa". Nós também não a colocamos no "Splash / Gate" para não barrar usuários; é pedida junto das essenciais (câmera/mic) logo antes do visor. Utilizamos `require` síncrono para consumir do `expo-location`, de forma que, se o pacote falhar e retornar `null`, apenas desabilitamos a busca.

## Compartilhamento ao Sistema (Share Target)
Houve uma tentativa de compartilhar diretamente com o pacote do Instagram. Porém, foi descoberto que usar Intents diretos para MP4 é bloqueado na interface do Instagram no Android, forçando o app a jogar para a folha de compartilhamento nativa e genérica do sistema (`Share.share()`), onde o próprio sistema resolve o Target da mídia.
