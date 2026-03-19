# Sui Gas Station API

A reusable sponsored-transaction API for Sui dApps. It abstracts user gas costs by returning sponsor-signed transaction bytes that users finalize with their wallet signature.

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
- `ALLOWLIST`: `package::module::function` list
- `ALLOW_ALL_TRANSACTIONS=true` enables wildcard sponsorship (recommended only for controlled test environments)

## Local run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm start
```

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
