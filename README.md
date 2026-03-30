# Sui Gas Station + Developer Portal Foundation

OpenSignal is a sponsored-transaction API for Sui dApps with a new Vite + React developer portal foundation and Prisma-backed data model.

## Implemented flow

1. dApp builds `transactionKind` bytes client-side.
2. dApp sends payload to `/v1/sponsor/sign` with `x-api-key`.
3. Service validates allowlisted Move calls and gas limits.
4. Service sets sponsor gas data, dry-runs, and sponsor-signs.
5. dApp asks user wallet to sign the returned bytes.
6. dApp submits dual-signed transaction directly to a Sui fullnode.

## Endpoints

- `GET /health`
- `POST /v1/auth/validate`
- `POST /v1/sponsor/quote`
- `POST /v1/sponsor/sign`

Portal foundation endpoints:
- `POST /v1/portal/auth/signup`
- `POST /v1/portal/auth/login`
- `GET /v1/portal/me`
- `GET /v1/portal/apps`
- `POST /v1/portal/apps`
- `PATCH /v1/portal/apps/:appId`
- `GET /v1/portal/apps/:appId/api-keys`
- `POST /v1/portal/apps/:appId/api-keys`
- `POST /v1/portal/api-keys/:keyId/revoke`
- `GET /v1/portal/usage/summary?appId=<id>`

## Request shape (`/v1/sponsor/sign`)

```json
{
  "transactionKind": "BASE64_KIND_BYTES",
  "sender": "0x...",
  "requestedCalls": [
    {
      "package": "0x2",
      "module": "pay",
      "function": "split"
    }
  ],
  "maxGasBudget": 12000000,
  "network": "testnet",
  "idempotencyKey": "optional-idempotency-key"
}
```

## Environment

Use `.env.example` as the baseline.

Important values:
- `SPONSOR_PRIVATE_KEY`: `suiprivkey...`
- `API_KEYS`: `dappA:keyA,dappB:keyB`
- `DATABASE_URL`: PostgreSQL connection string for Prisma
- `PORTAL_JWT_SECRET`: JWT signing secret (minimum 32 chars)
- `FRONTEND_URL`: allowed frontend origin for CORS (`http://localhost:5173` in dev)
- `ALLOWLIST`: `package::module::function` list
- `ALLOW_ALL_TRANSACTIONS=true` enables wildcard sponsorship (recommended only for controlled test environments)

## Prisma setup

1. Create a PostgreSQL database.
2. Set `DATABASE_URL` in `.env`.
3. Generate Prisma client:

```bash
npm run prisma:generate
```

4. Create and apply migrations:

```bash
npm run prisma:migrate -- --name init-portal
```

## Local run

```bash
npm install
npm run dev
```

Run frontend (Vite + React) in another terminal:

```bash
npm run web:dev
```

## Build

```bash
npm run build
npm start
```

Build frontend:

```bash
npm run web:build
```

## Frontend routes (foundation)

- `/` landing page
- `/docs` docs quickstart page
- `/portal` developer portal overview
- `/portal/login` portal login form stub

## Deploy on Render

1. Push this repo to GitHub.
2. In Render, create a new Web Service from the repo.
3. Render auto-detects `render.yaml`.
4. Set secret env vars in Render dashboard (`SPONSOR_PRIVATE_KEY`, `API_KEYS`, `ALLOWLIST`, `SUI_RPC_URL`).
5. Deploy and use the generated `https://<service>.onrender.com` URL for dApp API calls.

## Security notes

- Keep sponsor keys out of logs.
- Use tight allowlists for Move calls.
- Prefer user-side submission to fullnodes to reduce censorship risk.
- Rotate API keys and enforce per-dApp quotas.
