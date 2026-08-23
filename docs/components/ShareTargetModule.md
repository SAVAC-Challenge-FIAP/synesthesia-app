# Documentação de `ShareTargetModule.ts`

Apps instalados que sabem receber um `ACTION_SEND` deste `mimeType`,
já com nome e ícone reais. Lista vazia = ninguém recebe este tipo.

Só enxerga o que o `<queries>` do manifesto do módulo declara — no
Android 11+ a visibilidade de pacotes é fechada por padrão.

Manda o arquivo direto para (pacote, atividade), sem passar pela folha do
sistema. O caminho vira `content://` por FileProvider e a permissão de
leitura é concedida ao destino no próprio Intent.

Rejeita se o app tiver sido desinstalado entre a listagem e o toque.

