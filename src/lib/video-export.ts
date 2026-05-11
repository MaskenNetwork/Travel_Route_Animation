import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export interface ExportSettings {
  width: number;
  height: number;
  fps: number;
  duration: number; // seconds
  bitrate?: number;
}

const MAX_EXPORT_PIXELS = 3840 * 2160;
const MAX_EXPORT_FRAMES = 60 * 60 * 10;

export async function exportVideo(
  renderFrame: (progress: number, ctx: CanvasRenderingContext2D) => void,
  settings: ExportSettings,
  onProgress?: (progress: number) => void
) {
  validateExportSettings(settings);

  if (!('VideoEncoder' in window) || !('VideoFrame' in window)) {
    throw new Error('Il browser non supporta WebCodecs. Prova con una versione recente di Chrome o Edge.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = settings.width;
  canvas.height = settings.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Impossibile creare il contesto canvas per l export.');

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: settings.width,
      height: settings.height
    },
    fastStart: 'in-memory'
  });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
    error: (error) => {
      encoderError = error;
    }
  });

  const supportedConfig = await getBestSupportedConfig({
    width: settings.width,
    height: settings.height,
    bitrate: settings.bitrate || getRecommendedBitrate(settings.width, settings.height, settings.fps),
    framerate: settings.fps
  });
  if (!supportedConfig) {
    throw new Error(`Impostazioni video non supportate dal browser: ${settings.width}x${settings.height} ${settings.fps}fps.`);
  }

  encoder.configure(supportedConfig);

  const totalFrames = Math.max(1, Math.ceil(settings.fps * settings.duration));
  
  for (let i = 0; i < totalFrames; i++) {
    const progress = totalFrames === 1 ? 1 : i / (totalFrames - 1);
    
    // Render the frame
    renderFrame(progress, ctx);
    
    // Create VideoFrame
    const frame = new VideoFrame(canvas, {
      timestamp: (i * 1_000_000) / settings.fps // microseconds
    });
    
    encoder.encode(frame);
    frame.close();

    if (encoderError) {
      throw encoderError;
    }

    if (onProgress) {
      onProgress((i + 1) / totalFrames);
    }

    // Give some time for the encoder to process
    if (i % 30 === 0) {
      await encoder.flush();
    }
  }

  await encoder.flush();
  if (encoderError) {
    throw encoderError;
  }
  muxer.finalize();

  const buffer = (muxer.target as ArrayBufferTarget).buffer;
  return new Blob([buffer], { type: 'video/mp4' });
}

function validateExportSettings(settings: ExportSettings) {
  if (!Number.isFinite(settings.width) || !Number.isFinite(settings.height) || settings.width <= 0 || settings.height <= 0) {
    throw new Error('Dimensioni di esportazione non valide.');
  }

  if (settings.width * settings.height > MAX_EXPORT_PIXELS) {
    throw new Error('La risoluzione richiesta supera il limite massimo supportato.');
  }

  if (!Number.isFinite(settings.fps) || settings.fps < 1 || settings.fps > 60) {
    throw new Error('FPS di esportazione non validi.');
  }

  if (!Number.isFinite(settings.duration) || settings.duration <= 0) {
    throw new Error('Durata di esportazione non valida.');
  }

  if (settings.fps * settings.duration > MAX_EXPORT_FRAMES) {
    throw new Error('Il video richiesto contiene troppi frame. Riduci durata, FPS o risoluzione.');
  }
}

function getRecommendedBitrate(width: number, height: number, fps: number) {
  const pixels = width * height;
  const bitsPerPixelFrame = 0.16;

  return Math.round(pixels * fps * bitsPerPixelFrame);
}

async function getBestSupportedConfig(baseConfig: Omit<VideoEncoderConfig, 'codec'>) {
  const codecs = [
    'avc1.64003E', // High Profile, Level 6.2
    'avc1.64003D', // High Profile, Level 6.1
    'avc1.64003C', // High Profile, Level 6.0
    'avc1.640034', // High Profile, Level 5.2
    'avc1.640033', // High Profile, Level 5.1
    'avc1.640032', // High Profile, Level 5.0
    'avc1.64002A', // High Profile, Level 4.2
  ];

  for (const codec of codecs) {
    const result = await VideoEncoder.isConfigSupported({ ...baseConfig, codec });
    if (result.supported && result.config) {
      return result.config;
    }
  }

  return null;
}
