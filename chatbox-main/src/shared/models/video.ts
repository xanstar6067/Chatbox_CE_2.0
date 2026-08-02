import { ApiError } from './errors'

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export async function responseToVideoDataUrl(response: Response, fallbackMediaType = 'video/mp4') {
  if (!response.ok) {
    throw new ApiError(`Failed to download generated video (${response.status}): ${await response.text()}`)
  }
  const mediaType = response.headers.get('content-type')?.split(';')[0] || fallbackMediaType
  return {
    dataUrl: `data:${mediaType};base64,${arrayBufferToBase64(await response.arrayBuffer())}`,
    mediaType,
  }
}

export function apiErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') return error.message
    if ('error' in error) return apiErrorMessage(error.error)
  }
  return 'Video generation failed'
}
