/**
 * @docs docs/components/ShareTargetModule.md
 */
import { NativeModule, requireNativeModule } from "expo";

import { DestinoNativo } from "./ShareTarget.types";

declare class ShareTargetModule extends NativeModule {
  listarDestinos(mimeType: string): DestinoNativo[];

  compartilharEm(
    pacote: string,
    atividade: string,
    caminho: string,
    mimeType: string,
    texto: string | null,
  ): Promise<void>;
}

export default requireNativeModule<ShareTargetModule>("ShareTarget");
