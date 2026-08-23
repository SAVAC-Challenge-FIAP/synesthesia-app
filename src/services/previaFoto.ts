/**
 * @docs docs/components/previaFoto.md
 */
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

const PREVIA_LARGURA = 1440;

const PREVIA_COMPRESSAO = 0.9;

const cache = new Map<string, Promise<string>>();

export function previaParaSkia(uri: string): Promise<string> {
  const emCache = cache.get(uri);
  if (emCache) return emCache;

  const tarefa = (async () => {
    try {
      const contexto = ImageManipulator.manipulate(uri);
      contexto.resize({ width: PREVIA_LARGURA });
      const imagem = await contexto.renderAsync();
      const salva = await imagem.saveAsync({
        compress: PREVIA_COMPRESSAO,
        format: SaveFormat.JPEG,
      });
      return salva.uri;
    } catch (erro) {
      console.warn("[previaFoto] resize falhou, usando a original:", erro);
      return uri;
    }
  })();

  cache.set(uri, tarefa);
  return tarefa;
}
