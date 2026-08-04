import { registerWebModule, NativeModule } from 'expo';

import { VideoMuxerModuleEvents } from './VideoMuxer.types';

/** Sem implementação web: o muxer de vídeo é Android-only (MediaMuxer/MediaCodec). */
class VideoMuxerModule extends NativeModule<VideoMuxerModuleEvents> {
  async muxImageAndAudio(): Promise<string> {
    throw new Error('VideoMuxer não está disponível na web.');
  }
}

export default registerWebModule(VideoMuxerModule, 'VideoMuxerModule');
