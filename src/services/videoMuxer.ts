import { Directory, File, Paths } from 'expo-file-system';

/**
 * Geração do .mp4 real (imagem + trilha) via módulo nativo local (T-07).
 *
 * `modules/video-muxer` (Android: MediaMuxer/MediaCodec) só carrega em
 * development build — no Expo Go o `require` do módulo nativo lança na
 * primeira chamada. Por isso tudo aqui é best-effort: qualquer falha (Expo
 * Go, plataforma não suportada, erro de encoding) devolve `null` e
 * `sharePackage.ts` mantém o pacote composto atual (RN "nunca perder a
 * foto" — o vídeo é um extra, não um requisito para salvar/postar).
 */

/**
 * Recebe o progresso da exportação, de 0 a 100. Só é chamado quando o device
 * sabe informar de fato — se nunca for chamado, o indicador deve permanecer
 * indefinido em vez de fingir avanço (contrato C-04).
 */
export type OnProgresso = (progresso: number) => void;

export async function muxImageAndAudio(params: {
  imageUri: string;
  audioUri: string;
  durationSeconds: number;
  onProgresso?: OnProgresso;
}): Promise<string | null> {
  let inscricao: { remove: () => void } | null = null;
  try {
    // Import dinâmico: em runtimes sem o módulo nativo (Expo Go), a falha
    // fica isolada nesta função em vez de quebrar o bundle inteiro.
    const { default: VideoMuxer } = await import('../../modules/video-muxer/src/VideoMuxerModule');

    const outputDir = new Directory(Paths.cache, 'synesthesia-video');
    if (!outputDir.exists) outputDir.create({ intermediates: true });
    const output = new File(outputDir, `pacote-${Date.now()}.mp4`);

    if (params.onProgresso) {
      const notificar = params.onProgresso;
      // `addListener` pode não existir em runtimes antigos do módulo; a
      // exportação não pode falhar por causa de um extra informativo (C-01).
      try {
        inscricao = VideoMuxer.addListener('onProgress', ({ progresso, estado }) => {
          // `iniciando` não é avanço, é só o aviso de que começou — repassá-lo
          // como 0 faria a barra "zerar" visualmente a cada exportação.
          if (estado === 'exportando' || estado === 'concluido') notificar(progresso);
        });
      } catch {
        inscricao = null;
      }
    }

    const uri = await VideoMuxer.muxImageAndAudio(
      params.imageUri,
      params.audioUri,
      output.uri,
      params.durationSeconds
    );
    return uri;
  } catch (error) {
    console.warn('[videoMuxer] falha ao gerar .mp4, mantendo pacote sem vídeo:', error);
    return null;
  } finally {
    inscricao?.remove();
  }
}
