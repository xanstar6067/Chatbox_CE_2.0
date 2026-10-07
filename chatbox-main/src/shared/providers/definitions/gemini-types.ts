import { getGeminiMajorVersion } from '../../utils/google-thinking'

/**
 * Gemini image generation aspect ratio values supported by the Google AI SDK.
 * @see https://ai.google.dev/gemini-api/docs/image-generation#aspect_ratios
 */
export type GeminiAspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9'

/**
 * Build an `imageConfig` object for Gemini provider options if a valid aspect ratio is provided.
 * Centralises the `string → GeminiAspectRatio` cast that was duplicated across gemini,
 * custom-gemini, and chatboxai providers.
 */
export function buildGeminiImageConfig(
  aspectRatio: string | undefined
): { aspectRatio: GeminiAspectRatio } | undefined {
  if (aspectRatio && aspectRatio !== 'auto') {
    return { aspectRatio: aspectRatio as GeminiAspectRatio }
  }
  return undefined
}

/**
 * Google deprecated temperature, topP and topK for the Gemini 3 series: Gemini 3.6 Flash
 * and later ignore them, upcoming models reject them with HTTP 400, and Google asks to
 * drop them so the model uses its own defaults. Only Gemini 1.x/2.x and non-Gemini models
 * served through the same API (e.g. Gemma) still receive them.
 * @see https://ai.google.dev/gemini-api/docs/changelog
 */
export function supportsGeminiSamplingParameters(modelId: string): boolean {
  const major = getGeminiMajorVersion(modelId)
  return major === undefined || major < 3
}
