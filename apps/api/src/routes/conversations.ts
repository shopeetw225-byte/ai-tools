import { Hono } from 'hono'
import type { Env } from '../index'

const conversations = new Hono<{ Bindings: Env }>()

conversations.get('/', async (c) => {
  const userId = c.get('userId' as never) as string
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT id, title, model, created_at, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50`
    )
      .bind(userId)
      .all<{ id: string; title: string; model: string; created_at: string; updated_at: string }>()
    return c.json({ conversations: results })
  } catch {
    return c.json({ conversations: [] })
  }
})

conversations.get('/:id/messages', async (c) => {
  const userId = c.get('userId' as never) as string
  const id = c.req.param('id')
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT m.id, m.role, m.content, m.created_at FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE m.conversation_id = ? AND c.user_id = ? ORDER BY m.created_at ASC`
    )
      .bind(id, userId)
      .all<{ id: string; role: string; content: string; created_at: string }>()
    return c.json({ messages: results })
  } catch {
    return c.json({ messages: [] })
  }
})

export default conversations
