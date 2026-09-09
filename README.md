# FPL Companion

FPL Companion is a live Fantasy Premier League dashboard for gameweek points, price-rise momentum, and explainable transfer ideas.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (needs `PORT`, e.g. `PORT=5000`)
- `pnpm --filter @workspace/fpl-companion run dev` — run the dashboard (needs `PORT` and `BASE_PATH`, e.g. `PORT=5173 BASE_PATH=/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

### Running locally (outside Replit)

- Node 20.19+/22.12+ is required (Vite's minimum); `.nvmrc` pins `22.22.0` — run `nvm use`.
- Replit injects `PORT`/`BASE_PATH` automatically; locally you must export them yourself (no `.env` loading in code, only a plain `PORT=5000` value in `artifacts/api-server/.env` for reference).
- The dashboard calls relative `/api/...` paths with no `setBaseUrl` call, so its own Vite dev server needs to proxy `/api` to the API server. `artifacts/fpl-companion/vite.config.ts` proxies `/api` to `API_PROXY_TARGET` (default `http://localhost:5000`) in dev — set `API_PROXY_TARGET` if the API server runs on a different port/host.
- macOS note: port 5000 is often held by the AirPlay Receiver (ControlCenter); either disable it in System Settings → General → AirDrop & Handoff, or run the API server on another port and set `API_PROXY_TARGET` to match.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Validation: Zod (`zod/v4`)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/fpl-companion` — responsive React dashboard and visual theme.
- `artifacts/api-server/src/lib/fpl.ts` — official FPL API adapter and recommendation scoring.
- `artifacts/api-server/src/routes/fpl.ts` — FPL route handlers.
- `lib/api-spec/openapi.yaml` — source-of-truth API contract; regenerate client packages after edits.

## Architecture decisions

- The dashboard uses the official FPL feed server-side so the browser never depends on third-party CORS behavior.
- Team IDs are stored in the browser's local storage; no user account or manager credentials are required for the first version.
- Price-rise signals are explicitly modeled estimates using public transfer momentum, form, ownership, and availability rather than presented as official FPL predictions.

## Product

- Shows the current and next gameweek deadlines.
- Shows live squad points and captaincy context for an entered FPL team ID.
- Surfaces market movers, price-rise watch items, and explainable transfer candidates.

## User preferences

No saved preferences yet.

## Gotchas

- The current FPL picks payload can omit purchase and selling prices, so the API adapter falls back to the player's current market price.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
