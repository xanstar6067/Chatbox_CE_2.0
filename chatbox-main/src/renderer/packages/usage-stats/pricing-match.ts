import type { ProviderModelInfo } from '@shared/types'
import type { ModelPricing } from '@shared/utils/cost'

const VENDORS: Record<string, string> = {
  gemini: 'google',
  openai: 'openai',
  'openai-responses': 'openai',
  azure: 'openai',
  claude: 'anthropic',
  deepseek: 'deepseek',
  qwen: 'qwen',
  'qwen-portal': 'qwen',
  moonshot: 'moonshotai',
  'moonshot-cn': 'moonshotai',
  minimax: 'minimax',
  'minimax-cn': 'minimax',
  'mistral-ai': 'mistralai',
  perplexity: 'perplexity',
  xAI: 'x-ai',
}

export function supportsReferencePricing(provider: string) {
  return !['chatbox-ai', 'ollama', 'lm-studio'].includes(provider)
}

/** IDs remain provider-native. Only the price lookup uses the OpenRouter catalog ID. */
export function matchOpenRouterPrice(
  modelId: string,
  provider: string,
  catalog: ProviderModelInfo[],
  referenceId?: string
): ModelPricing | undefined {
  const priced = catalog.filter((model) => model.pricing)
  const exact = (id: string) => priced.find((model) => model.modelId.toLowerCase() === id.toLowerCase())?.pricing
  if (referenceId) return exact(referenceId)
  const id = modelId.trim()
  const fullMatch = exact(id)
  if (fullMatch) return fullMatch
  // OpenRouter requests require the full catalog ID. Never guess its routing aliases.
  if (provider === 'openrouter') return undefined
  const vendor = VENDORS[provider]
  let nativeId = id.toLowerCase()
  if (vendor === 'google') nativeId = nativeId.replace(/^models\//, '')
  const direct = vendor ? exact(`${vendor}/${nativeId}`) : undefined
  if (direct) return direct
  const normalize = (value: string) =>
    vendor === 'anthropic' ? value.replace(/-\d{8}$/, '').replace(/-(\d{1,2})-(\d{1,2})(?=-|$)/, '-$1.$2') : value
  const candidates = priced.filter((model) => {
    const slash = model.modelId.indexOf('/')
    if (slash < 0 || (vendor && model.modelId.slice(0, slash).toLowerCase() !== vendor)) return false
    return normalize(model.modelId.slice(slash + 1).toLowerCase()) === normalize(nativeId)
  })
  return candidates.length === 1 ? candidates[0].pricing : undefined
}
