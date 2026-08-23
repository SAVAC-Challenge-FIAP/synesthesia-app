/**
 * @docs docs/components/ShareTargetModule.web.md
 */
import { registerWebModule, NativeModule } from "expo";

import { DestinoNativo } from "./ShareTarget.types";

class ShareTargetModule extends NativeModule {
  listarDestinos(): DestinoNativo[] {
    return [];
  }

  async compartilharEm(): Promise<void> {
    throw new Error("ShareTarget não está disponível na web.");
  }
}

export default registerWebModule(ShareTargetModule, "ShareTargetModule");
