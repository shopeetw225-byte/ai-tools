import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(currentDir, '../..')

function readWebFile(relativePath: string) {
  return readFileSync(resolve(webRoot, relativePath), 'utf8')
}

describe('i18n QA regressions', () => {
  it('ships a Pages worker for locale redirect and SPA fallback', () => {
    const workerPath = resolve(webRoot, 'public/_worker.js')

    expect(existsSync(workerPath)).toBe(true)

    const workerSource = readFileSync(workerPath, 'utf8')
    expect(workerSource).toContain('Accept-Language')
    expect(workerSource).toContain('/index.html')
  })

  it('removes leftover hardcoded UI labels from translated surfaces', () => {
    const chatPanelSource = readWebFile('src/components/ChatPanel.tsx')
    const toolPanelSource = readWebFile('src/components/ToolPanel.tsx')
    const authHookSource = readWebFile('src/hooks/useAuth.ts')

    expect(chatPanelSource).not.toMatch(/>\s*Chat\s*</)
    expect(toolPanelSource).not.toContain('Auto-detect')
    expect(authHookSource).not.toContain('Login failed')
    expect(authHookSource).not.toContain('Registration failed')
  })
})
