# Documentação de `ShareIntakeModule.web.ts`

Stub de web, pelo mesmo motivo do `VideoMuxerModule.web.ts`: sem ele o bundler
de web quebra ao resolver o import do módulo nativo.

`uriPendente()` devolve `null` (nunca há compartilhamento a consumir) e
`prepararImagem()` lança — quem chama já trata a ausência do módulo, então na
prática nenhum dos dois é alcançado.
