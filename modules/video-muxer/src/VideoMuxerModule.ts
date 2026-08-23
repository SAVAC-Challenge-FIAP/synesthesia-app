/**
 * @docs docs/components/VideoMuxerModule.md
 */
import { NativeModule, requireNativeModule } from "expo";

import { VideoMuxerModuleEvents } from "./VideoMuxer.types";

declare class VideoMuxerModule extends NativeModule<VideoMuxerModuleEvents> {
  muxImageAndAudio(
    imagePath: string,
    audioPath: string,
    outputPath: string,
    durationSeconds: number,
  ): Promise<string>;
}

export default requireNativeModule<VideoMuxerModule>("VideoMuxer");
