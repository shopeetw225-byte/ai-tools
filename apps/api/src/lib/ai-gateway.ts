/**
 * AI Gateway helpers — route AI API calls through Cloudflare AI Gateway
 * for unified logging, caching, and rate limiting.
 *
 * Supports:
 *  - Workers AI (via AI binding with gateway option)
 *  - Anthropic Claude (via AI Gateway proxy)
 */

/**
 * Extract the gateway name from a full Cloudflare AI Gateway URL.
 * URL format: https://gateway.ai.cloudflare.com/v1/{account}/{gateway-name}
 */
export function extractGatewayId(gatewayUrl: string): string {
  const parts = gatewayUrl.replace(/\/$/, '').split('/')
  return parts[parts.length - 1]
}

/** Options for Workers AI calls routed through the AI Gateway */
export function workersAIGatewayOptions(
  gatewayUrl: string | undefined,
): Record<string, unknown> | undefined {
  if (!gatewayUrl) return undefined
  return {
    gateway: {
      id: extractGatewayId(gatewayUrl),
      skipCache: false,
      cacheTtl: 300,
    },
  }
}

/**
 * Call an external provider (Anthropic, OpenAI) via Cloudflare AI Gateway.
 * The gateway URL acts as a transparent proxy, adding observability.
 */
export async function callExternalAI(
  gatewayUrl: string,
  provider: 'anthropic' | 'openai',
  path: string,
  body: unknown,
  apiKey: string,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const url = `${gatewayUrl}/${provider}${path}`
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  })
}

/**
 * Stream Anthropic Claude via AI Gateway.
 * Yields token strings as they arrive.
 */
export async function* streamAnthropicGateway(
  gatewayUrl: string,
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  model = 'claude-3-haiku-20240307',
): AsyncGenerator<string> {
  const systemMsg = messages.find((m) => m.role === 'system')
  const userMessages = messages.filter((m) => m.role !== 'system')

  const body = {
    model,
    max_tokens: 1024,
    system: systemMsg?.content,
    messages: userMessages,
    stream: true,
  }

  const res = await callExternalAI(
    gatewayUrl,
    'anthropic',
    '/v1/messages',
    body,
    apiKey,
    {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // AI Gateway requires Bearer token in Authorization; Anthropic also
      // accepts x-api-key — include both for gateway compatibility
    },
  )

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Anthropic API error ${res.status}: ${errText}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })

    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (!data || data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data) as {
          type?: string
          delta?: { type?: string; text?: string }
        }
        if (
          parsed.type === 'content_block_delta' &&
          parsed.delta?.type === 'text_delta' &&
          parsed.delta.text
        ) {
          yield parsed.delta.text
        }
      } catch {
        // skip malformed chunk
      }
    }
  }
}

/** Run Workers AI inference directly (no external API key needed) */
export async function runWorkersAI<T>(
  ai: Ai,
  model: string,
  inputs: Record<string, unknown>,
): Promise<T> {
  return ai.run(model as Parameters<Ai['run']>[0], inputs as never) as Promise<T>
}
