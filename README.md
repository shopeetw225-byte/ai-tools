# AI Tools — Cloudflare-Native Stack

Lightweight frontend AI tool platform, fully deployed on the Cloudflare ecosystem.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Cloudflare Pages (Vite + React + TypeScript + Tailwind) |
| Backend API | Cloudflare Workers (Hono) |
| Database | Cloudflare D1 (SQLite at the edge) |
| Object Storage | Cloudflare R2 |
| Cache / Sessions | Cloudflare KV |
| AI Routing | Cloudflare AI Gateway |
| Edge Inference | Cloudflare Workers AI |

## Local Development

```bash
# Prerequisites: Node 20+, pnpm 9+, wrangler CLI
npm install -g wrangler pnpm
wrangler login

# Install dependencies
pnpm install

# Start both apps concurrently
pnpm dev
```

- Frontend: http://localhost:5173
- API Worker: http://localhost:8787

## Cloudflare Resource Provisioning

Run once per environment:

```bash
# D1 database
wrangler d1 create ai-tools-db

# KV namespaces
wrangler kv namespace create AI_TOOLS_KV
wrangler kv namespace create AI_TOOLS_KV --preview

# R2 bucket
wrangler r2 bucket create ai-tools-assets

# Update apps/api/wrangler.toml with the generated IDs
```

AI Gateway and Workers AI are configured via Cloudflare Dashboard.

## Database Migrations

```bash
# Apply migrations to local D1
wrangler d1 execute ai-tools-db --local --file=db/migrations/0001_init.sql

# Apply to remote D1
wrangler d1 execute ai-tools-db --file=db/migrations/0001_init.sql
```

## CI/CD

GitHub Actions workflows deploy automatically on push to `main`:
- `deploy-api.yml` → Cloudflare Workers
- `deploy-web.yml` → Cloudflare Pages (with PR preview comments)

**Required GitHub Secrets:**
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
