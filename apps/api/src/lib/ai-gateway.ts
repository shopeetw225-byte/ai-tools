/**
 * AI Gateway helper — routes AI API calls through Cloudflare AI Gateway
 * for unified logging, caching, and rate limiting.
 *
 * Usage:
 *   const response = await callAI(env, 'openai', '/chat/completions', body)
 */

type AIProvider = 'openai' | 'anthropic' | 'huggingface'

export async function callAI(
  gatewayUrl: string,
  provider: AIProvider,
  path: string,
  body: unknown,
  apiKey: string,
): Promise<Response> {
  const url = `${gatewayUrl}/${provider}${path}`
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })
}

/** Run Workers AI inference directly (no external API key needed) */
export async function runWorkersAI<T>(
  ai: Ai,
  model: string,
  inputs: Record<string, unknown>,
): Promise<T> {
  return ai.run(model as Parameters<Ai['run']>[0], inputs as never) as Promise<T>
}
