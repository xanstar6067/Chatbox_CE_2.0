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
 * Google deprecated temperature, topP and topK starting with Gemini 3.6 Flash and
 * Gemini 3.5 Flash-Lite. Those models ignore the fields, and later generations will
 * reject them with HTTP 400, so they must not be sent.
 * @see https://ai.google.dev/gemini-api/docs/changelog
 */
export function supportsGeminiSamplingParameters(modelId: string): boolean {
  const match = modelId.toLowerCase().match(/^gemini-(\d+)(?:\.(\d+))?-(.+)$/)
  if (!match) {
    return true
  }
  const major = Number(match[1])
  const minor = Number(match[2] ?? 0)
  if (major !== 3) {
    return major < 3
  }
  if (minor >= 6) {
    return false
  }
  return !(minor === 5 && match[3].startsWith('flash-lite'))
}
