/**
 * @docs docs/components/ShareIntakeModule.web.md
 */
import { registerWebModule, NativeModule } from "expo";

import { ImagemRecebida, ShareIntakeModuleEvents } from "./ShareIntake.types";

class ShareIntakeModule extends NativeModule<ShareIntakeModuleEvents> {
  uriPendente(): string | null {
    return null;
  }

  async prepararImagem(): Promise<ImagemRecebida> {
    throw new Error("ShareIntake não está disponível na web.");
  }
}

export default registerWebModule(ShareIntakeModule, "ShareIntakeModule");
