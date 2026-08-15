/**
 * Um app do aparelho capaz de receber o pacote sensorial.
 *
 * Tudo aqui vem do `PackageManager`: o nome e o ícone são os **do aparelho da
 * pessoa**, não assets nossos. É por isso que a grade não precisa de uma
 * biblioteca de logos versionada — o Instagram dela é o ícone do Instagram
 * dela, na versão que ela tem instalada.
 */
export interface DestinoNativo {
  /** `com.instagram.android`, `com.whatsapp`, ... */
  pacote: string;
  /** Activity concreta que recebe o `ACTION_SEND` — o destino é o par (pacote, atividade) */
  atividade: string;
  /** Rótulo que o próprio app declara ("Instagram", "WhatsApp") */
  nome: string;
  /** Ícone do app como data URI PNG, pronto para `<Image source={{ uri }}>` */
  icone: string;
}
