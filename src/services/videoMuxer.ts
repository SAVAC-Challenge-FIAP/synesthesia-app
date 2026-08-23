/**
 * @docs docs/components/videoMuxer.md
 */
import { Directory, File, Paths } from "expo-file-system";

export type OnProgresso = (progresso: number) => void;

function limparPacotesAntigos(dir: Directory): void {
  try {
    for (const item of dir.list()) {
      if (item instanceof File && item.name.endsWith(".mp4")) item.delete();
    }
  } catch (error) {
    console.warn("[videoMuxer] nao deu para limpar pacotes antigos:", error);
  }
}

export async function muxImageAndAudio(params: {
  imageUri: string;
  audioUri: string;
  durationSeconds: number;
  onProgresso?: OnProgresso;
}): Promise<string | null> {
  let inscricao: { remove: () => void } | null = null;
  try {
    const { default: VideoMuxer } =
      await import("../../modules/video-muxer/src/VideoMuxerModule");

    const outputDir = new Directory(Paths.cache, "synesthesia-video");
    if (!outputDir.exists) outputDir.create({ intermediates: true });
    limparPacotesAntigos(outputDir);
    const output = new File(outputDir, `pacote-${Date.now()}.mp4`);

    if (params.onProgresso) {
      const notificar = params.onProgresso;

      try {
        inscricao = VideoMuxer.addListener(
          "onProgress",
          ({ progresso, estado }) => {
            if (estado === "exportando" || estado === "concluido")
              notificar(progresso);
          },
        );
      } catch {
        inscricao = null;
      }
    }

    const uri = await VideoMuxer.muxImageAndAudio(
      params.imageUri,
      params.audioUri,
      output.uri,
      params.durationSeconds,
    );
    return uri;
  } catch (error) {
    console.warn(
      "[videoMuxer] falha ao gerar .mp4, mantendo pacote sem vídeo:",
      error,
    );
    return null;
  } finally {
    inscricao?.remove();
  }
}
