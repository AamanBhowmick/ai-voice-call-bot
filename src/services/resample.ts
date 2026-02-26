/**
 * Audio Resampler
 * ─────────────────────────────────────────────────────────────────────────────
 * Simple linear-interpolation resampler for PCM 16-bit mono audio.
 * No external dependencies — pure math on Buffer data.
 *
 * Used to bridge Exotel (8kHz PCM) ↔ Azure OpenAI Realtime (24kHz PCM).
 *   upsample:   8kHz → 24kHz  (incoming caller audio → OpenAI)
 *   downsample: 24kHz → 8kHz  (OpenAI TTS → send back to caller)
 */

/**
 * Resample a PCM 16-bit LE mono buffer from one sample rate to another.
 * Uses linear interpolation for decent quality without external deps.
 */
export function resamplePCM(
  input: Buffer,
  fromRate: number,
  toRate: number
): Buffer {
  if (fromRate === toRate) return input;

  const bytesPerSample = 2; // 16-bit
  const inputSamples = input.length / bytesPerSample;
  const ratio = toRate / fromRate;
  const outputSamples = Math.round(inputSamples * ratio);
  const output = Buffer.alloc(outputSamples * bytesPerSample);

  for (let i = 0; i < outputSamples; i++) {
    // Map output index back to input position
    const srcPos = i / ratio;
    const srcIdx = Math.floor(srcPos);
    const frac = srcPos - srcIdx;

    // Read the two surrounding samples (clamp at boundary)
    const s0 = srcIdx < inputSamples ? input.readInt16LE(srcIdx * bytesPerSample) : 0;
    const s1 = srcIdx + 1 < inputSamples ? input.readInt16LE((srcIdx + 1) * bytesPerSample) : s0;

    // Linear interpolation
    const interpolated = Math.round(s0 + frac * (s1 - s0));

    // Clamp to 16-bit signed range
    const clamped = Math.max(-32768, Math.min(32767, interpolated));
    output.writeInt16LE(clamped, i * bytesPerSample);
  }

  return output;
}

/** Convenience: 8kHz → 24kHz (Exotel → OpenAI Realtime) */
export function upsample8to24(buf: Buffer): Buffer {
  return resamplePCM(buf, 8000, 24000);
}

/** Convenience: 24kHz → 8kHz (OpenAI Realtime → Exotel) */
export function downsample24to8(buf: Buffer): Buffer {
  return resamplePCM(buf, 24000, 8000);
}
