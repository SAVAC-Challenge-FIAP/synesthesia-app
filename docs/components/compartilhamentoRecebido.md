# Documentação de `compartilhamentoRecebido.ts`

Camada fina entre o app e o módulo nativo `share-intake`.

O import do módulo é **dinâmico e memoizado**, como em `videoMuxer.ts`: em web
ou num build sem o módulo nativo (o app roda em Expo Go durante parte do
desenvolvimento), `requireNativeModule` lança na importação. Resolvendo por
`await import` dentro de try, a ausência do módulo vira "não há
compartilhamento" em vez de derrubar o bundle inteiro.

Todas as funções degradam para `null` em vez de propagar erro: o
compartilhamento é um caminho de entrada extra, e uma falha aqui não pode
impedir o app de abrir na câmera.
