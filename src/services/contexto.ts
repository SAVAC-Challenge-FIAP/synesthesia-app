/**
 * Contexto da cena — hora e lugar — para enriquecer a leitura do Gemini
 * (feature 005, US2/US4, FR-034).
 *
 * Duas informações de naturezas muito diferentes, e o módulo trata cada uma
 * como ela merece:
 *
 * - **Hora** é grátis: `new Date()` não pede permissão, não usa rede e não tem
 *   caminho de falha. Entra sempre.
 * - **Lugar** é permissão nova, dado pessoal e latência. O consentimento
 *   acontece no **onboarding** (card próprio, com justificativa); depois disso
 *   entra como texto de cidade — **nunca coordenada** — e some em silêncio ao
 *   primeiro sinal de problema. O flag `usarLocalizacao` dos Ajustes é a via de
 *   revogação a qualquer momento (Princípio IV).
 *
 * ⚠️ **LGPD**: o que sai daqui para o prompt é `"Santos, SP"`, não um ponto no
 * mapa. A pergunta que o produto faz é "estou na praia?", e a cidade responde
 * isso sem entregar a posição de ninguém a um terceiro. Nada disto é
 * persistido — nem na sessão, nem na mídia: um dado que não é gravado não
 * precisa de política de retenção nem de tela de exclusão.
 */

/** Período legível do dia — é o que o modelo consegue usar, não um timestamp. */
function periodoDoDia(hora: number): string {
  if (hora >= 5 && hora < 8) return 'amanhecer';
  if (hora >= 8 && hora < 11) return 'manhã';
  if (hora >= 11 && hora < 14) return 'meio-dia';
  if (hora >= 14 && hora < 17) return 'tarde';
  if (hora >= 17 && hora < 19) return 'fim de tarde';
  if (hora >= 19 && hora < 22) return 'início da noite';
  if (hora >= 22 || hora < 2) return 'noite';
  return 'madrugada';
}

/**
 * Teto próprio da resolução de lugar, curto de propósito.
 *
 * A curadoria já tem o teto de 22s do Gemini e o de 8s do Deezer; o lugar é
 * enfeite comparado a eles e não pode custar nada perto disso. Estourou, some
 * do prompt — a foto não espera por um dado opcional (FR-034).
 */
const LIMITE_LUGAR_MS = 3_000;

/** Promise que desiste — o mesmo padrão de `fetchComLimite` em `music.ts`. */
function comLimite<T>(promessa: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promessa,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * `expo-location`, resolvido de forma resiliente — **uma vez**.
 *
 * Era `await import('expo-location')` dentro de um `try`, na aposta de que o
 * `catch` cobriria o módulo ausente. Não cobre: quando o JS novo roda sobre um
 * binário antigo (Metro recarregado sem rebuild nativo), o Metro estoura
 * `Requiring unknown module "…"` e **derruba o app** antes de qualquer `catch`
 * do nosso código — foi o que aconteceu numa captura comum, com a build
 * anterior ao `expo-location` instalada.
 *
 * `require` síncrono dentro de try/catch resolve no momento em que o módulo é
 * de fato pedido e devolve `null` quando ele não existe, que é o que faz a
 * degradação prometida por FR-034 acontecer de verdade: sem lugar, sem crash.
 *
 * O resultado é memoizado porque a resposta não muda durante a execução — e
 * porque tentar de novo a cada foto seria repetir o mesmo erro em silêncio.
 */
type ModuloLocation = typeof import('expo-location');
let moduloLocation: ModuloLocation | null | undefined;

function carregarLocation(): ModuloLocation | null {
  if (moduloLocation !== undefined) return moduloLocation;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    moduloLocation = require('expo-location') as ModuloLocation;
  } catch (erro) {
    // Build nativa sem o módulo (rebuild pendente) ou Expo Go: some o lugar,
    // segue o app. Mesma postura do expo-media-library respondendo
    // 'unavailable' na galeria.
    console.log('[contexto] expo-location indisponível nesta build:', erro);
    moduloLocation = null;
  }
  return moduloLocation;
}

export interface ContextoCena {
  /** Sempre presente: `"início da noite (19h)"`. */
  hora: string;
  /** `"Santos, SP"` — texto, nunca coordenada. Ausente sem opt-in/permissão. */
  lugar?: string;
}

/** A parte que nunca falha, isolada para quem só precisa dela. */
export function horaDaCena(date: Date = new Date()): string {
  const h = date.getHours();
  return `${periodoDoDia(h)} (${h}h)`;
}

/**
 * Resolve o lugar como **texto de cidade** (D5).
 *
 * Três travas, nesta ordem, e qualquer uma delas devolve `undefined` sem
 * reclamar: opt-in desligado → permissão negada → tempo esgotado. Nenhuma
 * bloqueia a captura, nenhuma repete o pedido.
 *
 * A precisão é `Low` de propósito: a pergunta do produto é "estou na praia?", e
 * `Accuracy.Low` responde isso gastando menos bateria e menos tempo. Precisão
 * alta responderia melhor uma pergunta que o produto não faz.
 */
async function lugarDaCena(usarLocalizacao: boolean): Promise<string | undefined> {
  if (!usarLocalizacao) return undefined;
  const Location = carregarLocation();
  if (!Location) return undefined;
  try {
    // **Nunca pede permissão aqui.** O pedido é do onboarding
    // (`pedirLocalizacao`), uma vez só. Pedir no caminho da captura abriria o
    // diálogo do sistema no meio de uma foto — e o cenário 2 da US4 proíbe
    // repetir o pedido a cada disparo. Aqui só se consome o que já foi
    // concedido; sem isso, o lugar simplesmente não existe.
    const atual = await Location.getForegroundPermissionsAsync();
    if (!atual.granted) {
      console.log('[contexto] sem permissão de localização — seguindo só com hora e imagem');
      return undefined;
    }

    const posicao = await comLimite(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
      LIMITE_LUGAR_MS,
    );
    if (!posicao) {
      console.log('[contexto] localização não respondeu a tempo — seguindo sem lugar');
      return undefined;
    }

    // Geocodificação reversa: é o passo que transforma coordenada em cidade.
    // A coordenada morre aqui dentro e nunca chega ao prompt (D5).
    const enderecos = await comLimite(
      Location.reverseGeocodeAsync({
        latitude: posicao.coords.latitude,
        longitude: posicao.coords.longitude,
      }),
      LIMITE_LUGAR_MS,
    );
    const e = enderecos?.[0];
    if (!e) return undefined;

    const cidade = e.city ?? e.subregion ?? e.district ?? undefined;
    const regiao = e.region ?? undefined;
    const texto = [cidade, regiao].filter(Boolean).join(', ');
    return texto || undefined;
  } catch (erro) {
    // Serviço desligado, GPS sem sinal, geocodificação sem rede: tudo cai aqui
    // e tudo degrada igual — sem lugar, e sem atrapalhar a captura.
    console.log('[contexto] localização indisponível:', erro);
    return undefined;
  }
}

/**
 * Monta o contexto que vai ao prompt. Nunca rejeita: no pior caso devolve só a
 * hora, que é o piso e sempre existe.
 */
export async function montarContexto(usarLocalizacao: boolean): Promise<ContextoCena> {
  const hora = horaDaCena();
  const lugar = await lugarDaCena(usarLocalizacao);
  console.log(`[contexto] hora="${hora}" lugar="${lugar ?? '(ausente)'}"`);
  return { hora, lugar };
}

/**
 * Pede a permissão de localização — **uma vez, no onboarding** (feature 005).
 *
 * Fica separado de `montarContexto` de propósito: pedido de permissão é evento
 * de onboarding, não de captura. Misturar os dois faria o diálogo do sistema
 * aparecer no meio de uma foto, que é o caminho mais curto para alguém negar
 * por reflexo.
 *
 * Nunca rejeita e nunca bloqueia: o retorno é informativo. Recusar localização
 * não impede nada no app — a vibe passa a sair só da imagem e da hora
 * (FR-034), e a pessoa pode reconsiderar depois pelas configurações do sistema.
 */
export async function pedirLocalizacao(): Promise<boolean> {
  const Location = carregarLocation();
  if (!Location) return false;
  try {
    const atual = await Location.getForegroundPermissionsAsync();
    if (atual.granted) return true;
    // `canAskAgain === false` é "negada para sempre": insistir não abriria nada.
    if (!atual.canAskAgain) return false;
    const pedido = await Location.requestForegroundPermissionsAsync();
    console.log(`[contexto] permissão de localização: ${pedido.granted ? 'concedida' : 'negada'}`);
    return pedido.granted;
  } catch (erro) {
    // Serviço de localização indisponível no aparelho: segue sem lugar.
    console.log('[contexto] não foi possível pedir localização:', erro);
    return false;
  }
}
