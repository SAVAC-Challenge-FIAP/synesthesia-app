/**
 * @docs docs/components/contexto.md
 */

function periodoDoDia(hora: number): string {
  if (hora >= 5 && hora < 8) return "amanhecer";
  if (hora >= 8 && hora < 11) return "manhã";
  if (hora >= 11 && hora < 14) return "meio-dia";
  if (hora >= 14 && hora < 17) return "tarde";
  if (hora >= 17 && hora < 19) return "fim de tarde";
  if (hora >= 19 && hora < 22) return "início da noite";
  if (hora >= 22 || hora < 2) return "noite";
  return "madrugada";
}

const LIMITE_LUGAR_MS = 3_000;

function comLimite<T>(promessa: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promessa,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

type ModuloLocation = typeof import("expo-location");
let moduloLocation: ModuloLocation | null | undefined;

function carregarLocation(): ModuloLocation | null {
  if (moduloLocation !== undefined) return moduloLocation;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    moduloLocation = require("expo-location") as ModuloLocation;
  } catch (erro) {
    console.log("[contexto] expo-location indisponível nesta build:", erro);
    moduloLocation = null;
  }
  return moduloLocation;
}

export interface ContextoCena {
  hora: string;
  lugar?: string;
}

export function horaDaCena(date: Date = new Date()): string {
  const h = date.getHours();
  return `${periodoDoDia(h)} (${h}h)`;
}

async function lugarDaCena(
  usarLocalizacao: boolean,
): Promise<string | undefined> {
  if (!usarLocalizacao) return undefined;
  const Location = carregarLocation();
  if (!Location) return undefined;
  try {
    const atual = await Location.getForegroundPermissionsAsync();
    if (!atual.granted) {
      console.log(
        "[contexto] sem permissão de localização — seguindo só com hora e imagem",
      );
      return undefined;
    }

    const posicao = await comLimite(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
      LIMITE_LUGAR_MS,
    );
    if (!posicao) {
      console.log(
        "[contexto] localização não respondeu a tempo — seguindo sem lugar",
      );
      return undefined;
    }

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
    const texto = [cidade, regiao].filter(Boolean).join(", ");
    return texto || undefined;
  } catch (erro) {
    console.log("[contexto] localização indisponível:", erro);
    return undefined;
  }
}

export async function montarContexto(
  usarLocalizacao: boolean,
): Promise<ContextoCena> {
  const hora = horaDaCena();
  const lugar = await lugarDaCena(usarLocalizacao);
  console.log(`[contexto] hora="${hora}" lugar="${lugar ?? "(ausente)"}"`);
  return { hora, lugar };
}

export async function pedirLocalizacao(): Promise<boolean> {
  const Location = carregarLocation();
  if (!Location) return false;
  try {
    const atual = await Location.getForegroundPermissionsAsync();
    if (atual.granted) return true;

    if (!atual.canAskAgain) return false;
    const pedido = await Location.requestForegroundPermissionsAsync();
    console.log(
      `[contexto] permissão de localização: ${pedido.granted ? "concedida" : "negada"}`,
    );
    return pedido.granted;
  } catch (erro) {
    console.log("[contexto] não foi possível pedir localização:", erro);
    return false;
  }
}
