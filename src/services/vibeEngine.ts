/**
 * @docs docs/adr/0012-pipeline-de-curadoria-gemini-deezer.md
 */
import { VIBES } from "@/constants/vibes";
import { Vibe } from "@/types";

export interface VibeContext {
  facing: "front" | "back";
}

function vibesByPeriod(hour: number): Vibe[] {
  if (hour >= 5 && hour < 11) {
    return VIBES.filter((v) =>
      ["dourada", "energetica", "gelada", "sonhadora"].includes(v.id),
    );
  }
  if (hour >= 11 && hour < 17) {
    return VIBES.filter((v) =>
      ["energetica", "dourada", "aconchegante", "nostalgica"].includes(v.id),
    );
  }
  if (hour >= 17 && hour < 20) {
    return VIBES.filter((v) =>
      ["dourada", "romantica", "nostalgica", "aconchegante"].includes(v.id),
    );
  }
  return VIBES.filter((v) =>
    ["noturna", "sonhadora", "romantica", "nostalgica"].includes(v.id),
  );
}

export function detectVibe(ctx: VibeContext, date: Date = new Date()): Vibe {
  const candidates = vibesByPeriod(date.getHours());

  const pool =
    ctx.facing === "front"
      ? candidates.filter((v) =>
          ["romantica", "sonhadora", "dourada", "noturna"].includes(v.id),
        )
      : candidates;
  const list = pool.length > 0 ? pool : candidates;
  const escolhida = list[0];
  console.log(
    `[vibeEngine] prévia hora=${date.getHours()}h facing=${ctx.facing} → "${escolhida.id}" ` +
      `(determinística; a vibe real vem da análise da foto na captura)`,
  );
  return escolhida;
}
