import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Largura da cópia usada na prévia por Skia.
 *
 * A tela deste aparelho tem 1080px de largura; 1440 dá folga para o
 * `fit="cover"` recortar sem borrar, e ainda assim é ~4% dos pixels da foto
 * original de 6936px. Subir isso não melhora nada visível e volta a pesar.
 */
const PREVIA_LARGURA = 1440;

/** Compressão da cópia. 0.9 porque a prévia é justamente onde se julga cor. */
const PREVIA_COMPRESSAO = 0.9;

/**
 * Cache em memória: a mesma foto é pedida de novo a cada troca de look, e
 * refazer o resize a cada toque anularia o ganho. Some quando o app fecha,
 * que é o certo — os arquivos vivem no cache do sistema.
 */
const cache = new Map<string, Promise<string>>();

/**
 * Devolve uma cópia reduzida da foto, para o render por Skia consumir
 * (feature 003, US3).
 *
 * **Por que isto existe**: `useImage()` do Skia carrega a imagem inteira e
 * não expõe nenhuma API de downsampling — confirmado na documentação oficial
 * do pacote. Com os 6936×9248 (64 MP) que a câmera deste aparelho entrega,
 * isso são ~256 MB de bitmap descomprimido para exibir numa prévia de ~1000px
 * de largura. Era a causa da lentidão no modal de Captura e, na galeria, de o
 * app fechar sozinho.
 *
 * O `<Image>` do RN faz esse downsampling internamente; o Skia não. Então
 * fazemos antes, com o `expo-image-manipulator` que o projeto já usa para o
 * envio ao Gemini (`music.ts`) e para o enquadramento (`enquadrar.ts`).
 *
 * Em caso de falha devolve a `uri` original: perder a prévia por causa de uma
 * otimização seria pior que a prévia pesada.
 */
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
      console.warn('[previaFoto] resize falhou, usando a original:', erro);
      return uri;
    }
  })();

  cache.set(uri, tarefa);
  return tarefa;
}
