/**
 * @docs docs/components/ShareIntakeModule.md
 */
import { NativeModule, requireNativeModule } from "expo";

import { ImagemRecebida, ShareIntakeModuleEvents } from "./ShareIntake.types";

declare class ShareIntakeModule extends NativeModule<ShareIntakeModuleEvents> {
  uriPendente(): string | null;

  prepararImagem(origem: string): Promise<ImagemRecebida>;
}

export default requireNativeModule<ShareIntakeModule>("ShareIntake");
