/**
 * AI Gateway helpers — route AI API calls through Cloudflare AI Gateway
 * for unified logging, caching, and rate limiting.
 *
 * Supports:
 *  - Workers AI (via AI binding with gateway option)
 *  - Anthropic Claude (via AI Gateway proxy)
 */

export const AI_MAX_ATTEMPTS = 3
export const AI_REQUEST_TIMEOUT_MS = 30_000
const AI_RETRY_BASE_DELAY_MS = 250

type RetryOptions = {
  maxAttempts?: number
  timeoutMs?: number
  baseDelayMs?: number
  sleep?: (ms: number) => Promise<void>
  onError?: (context: {
    attempt: number
    maxAttempts: number
    error: AIRequestError
  }) => void
}

type AIRequestErrorOptions = {
  retryable?: boolean
  status?: number
  cause?: unknown
}

export class AIRequestError extends Error {
  retryable: boolean
  status?: number

  constructor(message: string, options: AIRequestErrorOptions = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'AIRequestError'
    this.retryable = options.retryable ?? false
    this.status = options.status
  }
}

export class AIRequestTimeoutError extends AIRequestError {
  constructor(timeoutMs: number, cause?: unknown) {
    super(`AI request timed out after ${timeoutMs}ms`, {
      retryable: true,
      cause,
    })
    this.name = 'AIRequestTimeoutError'
  }
}

function isRetryableStatus(status?: number): boolean {
  return status === 408 || status === 429 || (status !== undefined && status >= 500)
}

function normalizeAIError(err: unknown, timeoutMs: number): AIRequestError {
  if (err instanceof AIRequestError) return err
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new AIRequestTimeoutError(timeoutMs, err)
  }

  const message = err instanceof Error ? err.message : String(err)
  return new AIRequestError(message, {
    retryable: /\b(fetch|network|timeout|timed out|socket|connection|temporar)/i.test(message),
    cause: err,
  })
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function readStreamWithTimeout<T>(
  reader: ReadableStreamDefaultReader<T>,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<T>> {
  const timeoutError = new AIRequestTimeoutError(timeoutMs)
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(timeoutError)
      queueMicrotask(() => {
        void reader.cancel(timeoutError).catch(() => {})
      })
    }, timeoutMs)
  })

  try {
    return await Promise.race([reader.read(), timeoutPromise])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function executeWithRetry<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? AI_MAX_ATTEMPTS
  const timeoutMs = options.timeoutMs ?? AI_REQUEST_TIMEOUT_MS
  const baseDelayMs = options.baseDelayMs ?? AI_RETRY_BASE_DELAY_MS
  const sleep = options.sleep ?? wait
  const deadline = Date.now() + timeoutMs

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) {
      throw new AIRequestTimeoutError(timeoutMs)
    }

    const controller = new AbortController()
    const timeoutError = new AIRequestTimeoutError(timeoutMs)
    let timeout: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort(timeoutError)
        reject(timeoutError)
      }, remainingMs)
    })

    try {
      return await Promise.race([operation(controller.signal), timeoutPromise])
    } catch (err) {
      const normalized =
        controller.signal.aborted && controller.signal.reason instanceof AIRequestError
          ? controller.signal.reason
          : normalizeAIError(err, timeoutMs)

      options.onError?.({ attempt, maxAttempts, error: normalized })

      if (!normalized.retryable || attempt === maxAttempts) {
        throw normalized
      }

      const remainingDelayBudgetMs = deadline - Date.now()
      if (remainingDelayBudgetMs <= 0) {
        throw new AIRequestTimeoutError(timeoutMs, normalized)
      }

      await sleep(Math.min(baseDelayMs * 2 ** (attempt - 1), remainingDelayBudgetMs))
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }

  throw new AIRequestError('AI request failed after exhausting retries')
}

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
  signal?: AbortSignal,
): Promise<Response> {
  const url = `${gatewayUrl}/${provider}${path}`
  return fetch(url, {
    method: 'POST',
    signal,
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
  options: RetryOptions = {},
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

  const res = await executeWithRetry(
    async (signal) => {
      const response = await callExternalAI(
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
        signal,
      )

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => response.statusText)
        throw new AIRequestError(
          `Anthropic API error ${response.status}: ${errText}`,
          {
            retryable: isRetryableStatus(response.status),
            status: response.status,
          },
        )
      }

      return response
    },
    options,
  )

  const responseBody = res.body
  if (!responseBody) {
    throw new AIRequestError('Anthropic API response body was missing', {
      retryable: true,
    })
  }

  const reader = responseBody.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await readStreamWithTimeout(reader, options.timeoutMs ?? AI_REQUEST_TIMEOUT_MS)
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
