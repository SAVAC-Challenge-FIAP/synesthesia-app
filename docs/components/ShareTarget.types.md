# Documentação de `ShareTarget.types.ts`

Um app do aparelho capaz de receber o pacote sensorial.

Tudo aqui vem do `PackageManager`: o nome e o ícone são os **do aparelho da
pessoa**, não assets nossos. É por isso que a grade não precisa de uma
biblioteca de logos versionada — o Instagram dela é o ícone do Instagram
dela, na versão que ela tem instalada.

/** `com.instagram.android`, `com.whatsapp`, ... */

/** Activity concreta que recebe o `ACTION_SEND` — o destino é o par (pacote, atividade) */

/** Rótulo que o próprio app declara ("Instagram", "WhatsApp") */

/** Ícone do app como data URI PNG, pronto para `<Image source={{ uri }}>` */

