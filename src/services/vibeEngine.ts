import { VIBES } from '@/constants/vibes';
import { Vibe } from '@/types';

/**
 * Motor de vibe contextual — versão Expo Go.
 *
 * O ML Kit (react-native-mlkit-image-labeling) exige dev build nativo e não roda
 * no Expo Go. Este módulo simula a detecção on-device combinando hora do dia,
 * câmera ativa e variação periódica, mantendo o contrato da arquitetura:
 * `detectVibe(contexto) → Vibe`. Em dev build, basta trocar a implementação
 * pela rotulagem de frames do ML Kit sem tocar no resto do app.
 */

export interface VibeContext {
  facing: 'front' | 'back';
  /** semente que muda periodicamente para simular mudança de cena */
  sceneSeed: number;
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
  return list[Math.abs(ctx.sceneSeed) % list.length];
}

/** Intervalo (ms) de recálculo da vibe no visor */
export const VIBE_TICK_MS = 8000;
