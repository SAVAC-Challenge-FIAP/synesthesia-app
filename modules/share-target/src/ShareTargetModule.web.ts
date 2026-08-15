import { registerWebModule, NativeModule } from 'expo';

import { DestinoNativo } from './ShareTarget.types';

/**
 * Sem implementação web: não existe `PackageManager` no navegador. Devolver
 * lista vazia faz a interface cair sozinha no botão da folha nativa, que é o
 * mesmo caminho de quem não tem nenhum app compatível instalado.
 */
class ShareTargetModule extends NativeModule {
  listarDestinos(): DestinoNativo[] {
    return [];
  }

  async compartilharEm(): Promise<void> {
    throw new Error('ShareTarget não está disponível na web.');
  }
}

export default registerWebModule(ShareTargetModule, 'ShareTargetModule');
