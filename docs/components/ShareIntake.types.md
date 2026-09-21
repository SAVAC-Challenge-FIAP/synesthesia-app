# Documentação de `ShareIntake.types.ts`

`ImagemRecebida` carrega `largura`/`altura` **dos pixels já rotacionados** —
não é o tamanho declarado no arquivo original. O app usa essas medidas para o
aspecto da sessão de captura, e o `<Image>` do RN aplicaria a orientação do
EXIF por conta própria: se o par não viesse do mesmo lugar que os pixels, a
foto entraria com o aspecto trocado (retrato exibido em caixa de paisagem).
