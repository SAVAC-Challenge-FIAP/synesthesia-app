import { exportPackage, SharePackage } from '@/services/sharePackage';
import { MusicSuggestion } from '@/types';

/**
 * Pré-geração do vídeo enquanto o usuário ainda decide.
 *
 * **Por quê**: a premissa do produto é agilizar o post. Gerar o `.mp4` só no
 * toque de "Postar" jogava fora todo o tempo em que o usuário já estava ali —
 * ouvindo a prévia, trocando a faixa, ajustando o recorte — e depois cobrava
 * dele ~10s parado olhando uma barra. Aqui o trabalho começa assim que o pacote
 * está definido, em segundo plano; se ele postar depois disso, o vídeo já está
 * pronto e a tela de destinos abre na hora.
 *
 * **Invalidação por chave**: o vídeo depende de foto, filtro, faixa e recorte.
 * Mudou qualquer um, o resultado anterior não serve mais. A chave abaixo é a
 * identidade do pacote; quem pede um vídeo pede *para uma chave*, e só recebe
 * se a chave ainda for a atual.
 *
 * **Uma por vez**: o muxer não sabe cancelar (fora do escopo do contrato), e
 * duas exportações concorrentes disputariam CPU e o cache de saída. Então há no
 * máximo uma geração em voo; se a chave mudar no meio, a que está rodando é
 * levada até o fim e **descartada**, e a nova entra em seguida.
 */

export interface ParametrosPacote {
  imageUri: string;
  musica: MusicSuggestion | null;
  trechoInicio: number;
  trechoFim: number;
}

/** Identidade do pacote: tudo que, mudando, invalida o vídeo já gerado. */
export function chavePacote(p: {
  photoUri: string;
  filtroId: string | null;
  musicaId: string | null;
  trechoInicio: number;
  trechoFim: number;
}): string {
  return [p.photoUri, p.filtroId ?? 'sem-filtro', p.musicaId ?? 'sem-musica', p.trechoInicio, p.trechoFim].join('|');
}

interface EmVoo {
  chave: string;
  promise: Promise<SharePackage | null>;
}

let pronto: { chave: string; pacote: SharePackage } | null = null;
let emVoo: EmVoo | null = null;
/** Última chave pedida enquanto algo já estava em voo. */
let pendente: { chave: string; montar: () => Promise<ParametrosPacote> } | null = null;

/** O pacote desta chave já está pronto? Devolve-o, ou null. */
export function obterPronto(chave: string): SharePackage | null {
  return pronto && pronto.chave === chave ? pronto.pacote : null;
}

/** Há uma geração em voo para esta chave? Devolve a promessa para aguardar. */
export function obterEmVoo(chave: string): Promise<SharePackage | null> | null {
  return emVoo && emVoo.chave === chave ? emVoo.promise : null;
}

/**
 * Pede a pré-geração do pacote de `chave`. Não faz nada se já estiver pronto
 * ou em voo para a mesma chave. `montar` só é chamada quando a geração começa
 * de fato — é ela que renderiza a imagem com filtro, e renderizar à toa custa.
 */
export function agendar(chave: string, montar: () => Promise<ParametrosPacote>): void {
  if (pronto?.chave === chave) return;
  if (emVoo?.chave === chave) return;
  if (emVoo) {
    // Já tem uma rodando: guarda esta como a próxima da fila (só a última importa)
    pendente = { chave, montar };
    return;
  }
  iniciar(chave, montar);
}

function iniciar(chave: string, montar: () => Promise<ParametrosPacote>): void {
  // Gerar um pacote novo **apaga os .mp4 anteriores** do cache (a limpeza do
  // T040, em videoMuxer.ts). Então o que estava pronto perde o arquivo agora,
  // e guardá-lo seria entregar um caminho que já não existe se o usuário
  // desfizesse a mudança e postasse antes desta geração terminar.
  pronto = null;

  const promise = (async () => {
    try {
      const params = await montar();
      // Sem trilha não há vídeo a antecipar — o pacote sai como imagem.
      if (!params.musica) return null;
      return await exportPackage(params);
    } catch (error) {
      console.warn('[preExport] falhou; a postagem gera na hora:', error);
      return null;
    }
  })();

  emVoo = { chave, promise };

  promise
    .then((pacote) => {
      // Só publica se esta ainda for a chave desejada — se o usuário mexeu no
      // recorte no meio do caminho, este resultado já nasceu obsoleto.
      if (pacote && emVoo?.chave === chave) pronto = { chave, pacote };
    })
    .finally(() => {
      if (emVoo?.chave === chave) emVoo = null;
      const proxima = pendente;
      pendente = null;
      if (proxima) iniciar(proxima.chave, proxima.montar);
    });
}

/**
 * Esquece tudo. Chamar ao encerrar a sessão: sem isso, o pacote de uma captura
 * antiga continuaria pronto na memória e poderia ser servido para outra foto
 * que, por coincidência de chave, parecesse a mesma.
 */
export function limpar(): void {
  pronto = null;
  emVoo = null;
  pendente = null;
}
