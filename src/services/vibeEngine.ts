import { VIBES } from '@/constants/vibes';
import { Vibe } from '@/types';

/**
 * Prévia de vibe do visor — versão Expo Go.
 *
 * A vibe REAL agora é inferida da própria foto pelo Gemini multimodal na
 * captura (`analyzePhotoAndSuggest` em src/services/music.ts) — T-0A. Este
 * módulo fornece apenas a prévia exibida no visor antes de existir foto, de
 * forma determinística: mesma hora + mesma câmera → mesma vibe, sem timer e
 * sem sorteio. Em dev build, a prévia pode ser trocada pela rotulagem de
 * frames do ML Kit mantendo o contrato `detectVibe(contexto) → Vibe`.
 */

export interface VibeContext {
  facing: 'front' | 'back';
}

function vibesByPeriod(hour: number): Vibe[] {
  if (hour >= 5 && hour < 11) {
    return VIBES.filter((v) => ['dourada', 'energetica', 'gelada', 'sonhadora'].includes(v.id));
  }
  if (hour >= 11 && hour < 17) {
    return VIBES.filter((v) => ['energetica', 'dourada', 'aconchegante', 'nostalgica'].includes(v.id));
  }
  if (hour >= 17 && hour < 20) {
    return VIBES.filter((v) => ['dourada', 'romantica', 'nostalgica', 'aconchegante'].includes(v.id));
  }
  return VIBES.filter((v) => ['noturna', 'sonhadora', 'romantica', 'nostalgica'].includes(v.id));
}

export function detectVibe(ctx: VibeContext, date: Date = new Date()): Vibe {
  const candidates = vibesByPeriod(date.getHours());
  // Câmera frontal puxa vibes mais "pessoais" (selfie): romântica/sonhadora quando disponíveis
  const pool =
    ctx.facing === 'front'
      ? candidates.filter((v) => ['romantica', 'sonhadora', 'dourada', 'noturna'].includes(v.id))
      : candidates;
  const list = pool.length > 0 ? pool : candidates;
  const escolhida = list[0];
  console.log(
    `[vibeEngine] prévia hora=${date.getHours()}h facing=${ctx.facing} → "${escolhida.id}" ` +
      `(determinística; a vibe real vem da análise da foto na captura)`,
  );
  return escolhida;
}
