import { Hono } from 'hono'
import type { Env } from '../index'

const conversations = new Hono<{ Bindings: Env }>()

conversations.get('/', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT id, title, model, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 50`
    ).all<{ id: string; title: string; model: string; created_at: string; updated_at: string }>()
    return c.json({ conversations: results })
  } catch {
    return c.json({ conversations: [] })
  }
})

conversations.get('/:id/messages', async (c) => {
  const id = c.req.param('id')
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`
    )
      .bind(id)
      .all<{ id: string; role: string; content: string; created_at: string }>()
    return c.json({ messages: results })
  } catch {
    return c.json({ messages: [] })
  }
})

export default conversations
