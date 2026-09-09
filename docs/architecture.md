# FPL Companion — Architecture & Sequence Diagrams

A live Fantasy Premier League dashboard. The React SPA renders gameweek state,
market movers, live squad points, and explainable transfer ideas. An Express
API server fetches the official FPL feed server-side (so the browser never
depends on third-party CORS), reshapes it into typed DTOs, and computes
price-rise, expected-performance, fixture-run, and recommendation scores.

## System architecture

```mermaid
graph TB
    subgraph browser["Browser — @workspace/fpl-companion (React SPA)"]
        UI["App.tsx<br/>dashboard views + wouter routes"]
        RQ["TanStack Query<br/>cache / refetch"]
        HOOKS["@workspace/api-client-react<br/>generated useGetFpl* hooks"]
        CF["custom-fetch.ts<br/>fetch wrapper, ApiError"]
        LS["localStorage<br/>fpl-companion-team-id"]
        UI --> RQ --> HOOKS --> CF
        UI --> LS
    end

    subgraph devproxy["Dev only"]
        VITE["Vite dev server<br/>proxies /api → API_PROXY_TARGET"]
    end

    subgraph api["@workspace/api-server (Express 5)"]
        MW["middleware<br/>pino-http · cors · json"]
        ROUTES["routes/<br/>health · fpl"]
        ADAPTER["lib/fpl.ts<br/>FPL adapter + scoring"]
        ZODVAL["@workspace/api-zod<br/>response validation"]
        MW --> ROUTES --> ADAPTER
        ROUTES --> ZODVAL
    end

    subgraph external["External"]
        FPL["Official FPL API<br/>fantasy.premierleague.com/api"]
    end

    CF -->|"relative /api/... (prod: same origin)"| ROUTES
    CF -.->|dev| VITE -.-> MW
    ADAPTER -->|bootstrap-static, entry, picks, fixtures| FPL

    subgraph spec["Contract & codegen (build time)"]
        OPENAPI["lib/api-spec/openapi.yaml<br/>source of truth"]
        ORVAL["Orval codegen"]
        OPENAPI --> ORVAL
        ORVAL -->|react-query client| HOOKS
        ORVAL -->|zod schemas + types| ZODVAL
    end
```

### Component notes

- **fpl-companion** — Vite + React + Tailwind + shadcn/ui. State/data via
  TanStack Query; routing via `wouter`. The entered FPL team ID is persisted in
  `localStorage` (`fpl-companion-team-id`); no accounts or credentials.
- **api-client-react** — Orval-generated React Query hooks (`useGetFplOverview`,
  `useGetFplTeam`, `useGetFplTeamPicks`, `useGetFplRecommendations`) that call a
  shared `customFetch` wrapper. Requests use relative `/api/...` paths.
- **api-server** — Express 5. `app.ts` wires `pino-http`, `cors`, body parsers,
  and mounts the router under `/api`. `routes/fpl.ts` validates params, calls the
  adapter, and re-validates responses with Zod before sending.
- **lib/fpl.ts** — the only place that talks to the official FPL API. Fetches
  `bootstrap-static`, `entry/{id}`, `entry/{id}/event/{gw}/picks`, and
  `fixtures`, maps raw payloads to DTOs, and computes `priceRiseChance`,
  expected-goal involvement per 90, availability, five-fixture difficulty,
  momentum, and transfer `recommendations`/`watchlist`. This is the baseline
  analytics provider; a separately licensed provider can be added behind this
  boundary for event-level or odds data.
- **api-spec / Orval** — `openapi.yaml` is the contract; codegen produces both the
  client hooks and the Zod schemas, keeping client and server types in sync.

## Sequence: Market overview load (no team ID)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant SPA as React SPA
    participant RQ as TanStack Query
    participant API as Express /api
    participant AD as lib/fpl.ts
    participant FPL as Official FPL API

    U->>SPA: Open dashboard
    SPA->>RQ: useGetFplOverview()
    RQ->>API: GET /api/fpl/overview
    API->>AD: getOverview()
    AD->>FPL: GET /bootstrap-static/
    FPL-->>AD: events, teams, elements
    AD->>AD: pick current/next GW, map players,<br/>score priceRiseChance, sort, take top 24
    AD-->>API: FplOverview DTO
    API->>API: GetFplOverviewResponse.parse (Zod)
    API-->>RQ: 200 JSON (or 502 on FplDataError)
    RQ-->>SPA: cached data
    SPA-->>U: gameweeks + market movers
```

## Sequence: Enter team ID → picks & recommendations

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant SPA as React SPA
    participant LS as localStorage
    participant RQ as TanStack Query
    participant API as Express /api
    participant AD as lib/fpl.ts
    participant FPL as Official FPL API

    U->>SPA: Enter FPL team ID
    SPA->>LS: save fpl-companion-team-id
    Note over SPA,RQ: hooks enabled once a valid teamId exists

    par Team summary
        SPA->>RQ: useGetFplTeam(teamId)
        RQ->>API: GET /api/fpl/teams/{teamId}
        API->>API: validate teamId (positive int) else 400
        API->>AD: getTeam(teamId)
        AD->>FPL: GET /entry/{teamId}/
        FPL-->>AD: entry payload
        AD-->>API: FplTeam DTO
        API-->>RQ: 200 (404 if not found, 502 on source error)
    and Squad picks
        SPA->>RQ: useGetFplTeamPicks(teamId)
        RQ->>API: GET /api/fpl/teams/{teamId}/picks
        API->>AD: getTeamPicks(teamId)
        AD->>FPL: bootstrap + entry + event picks + fixtures
        FPL-->>AD: payloads
        AD->>AD: map picks → players, compute points,<br/>fixture text, purchase/selling fallback
        AD-->>API: FplTeamPicks DTO
        API-->>RQ: 200
    and Transfer ideas
        SPA->>RQ: useGetFplRecommendations(teamId)
        RQ->>API: GET /api/fpl/teams/{teamId}/recommendations
        API->>AD: getRecommendations(teamId)
        AD->>AD: for weakest picks, find affordable same-position<br/>alternatives, score, build watchlist
        AD-->>API: FplRecommendations DTO
        API-->>RQ: 200
    end

    RQ-->>SPA: team, picks, recommendations
    SPA-->>U: squad points, captaincy, transfer candidates
```

## Request path (dev vs prod)

- **Dev**: SPA (Vite dev server) serves the app and proxies `/api` → the API
  server (`API_PROXY_TARGET`, default `http://localhost:5000`). The client makes
  no `setBaseUrl` call, so relative paths must be proxied.
- **Prod (Replit)**: a router combines both services under one origin, so the
  relative `/api/...` paths resolve to the API server directly
  (see `artifacts/*/.replit-artifact/artifact.toml`).
