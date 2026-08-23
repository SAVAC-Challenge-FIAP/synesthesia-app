/**
 * @docs docs/components/VideoMuxerModule.web.md
 */
import { registerWebModule, NativeModule } from "expo";

import { VideoMuxerModuleEvents } from "./VideoMuxer.types";

class VideoMuxerModule extends NativeModule<VideoMuxerModuleEvents> {
  async muxImageAndAudio(): Promise<string> {
    throw new Error("VideoMuxer não está disponível na web.");
  }
}

export default registerWebModule(VideoMuxerModule, "VideoMuxerModule");
