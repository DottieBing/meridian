# Meridian

Business intelligence, website investigation and prospecting platform.
Local-first, open-source stack, no paid APIs required.

## Layout

- `apps/web` - frontend
- `apps/api` - HTTP API
- `apps/worker` - background jobs
- `packages/db` - schema and migrations
- `packages/shared` - shared types and schemas
- `packages/engines/*` - one package per intelligence engine

## Setup

1. Install Node 22+, pnpm, PostgreSQL 17+
2. `cp .env.example .env`
3. `pnpm install`