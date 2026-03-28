export function createSseStream(frames: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(frame))
      }
      controller.close()
    },
  })
}

export function sseFrame(data: Record<string, unknown> | string): string {
  const payload = typeof data === 'string' ? data : JSON.stringify(data)
  return `data: ${payload}\n\n`
}

export function sseDone(): string {
  return 'data: [DONE]\n\n'
}
