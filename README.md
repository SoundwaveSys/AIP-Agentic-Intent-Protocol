# AIP — Agentic Intent Protocol

**The trust layer for autonomous agents.**

AIP is an open protocol concept designed to help AI agents operate within the boundaries of a user's original intent. It provides a structured approach to representing user instructions, validating intent, evaluating proposed transactions, and generating audit receipts.

**Jinni lets AI act on your behalf; AIP ensures it never acts beyond your intent; PayPal makes the transaction possible.**

## Why AIP?

AI agents can search, compare, plan, and recommend actions. But a recommendation should not automatically become an authorization to act.

AIP explores how to make user intent explicit and enforceable before an agent proceeds.

## Current features

- **Natural-language intent:** Parse a user's instruction into a structured intent.
- **Intent validation:** Check protocol fields, purpose, category, currency, budget, and agent identity fields.
- **Live commerce search:** Retrieve shopping results through a backend powered by SerpApi.
- **Authorization engine:** Evaluate proposed transactions against available intent constraints.

## Architecture

```text
Human instruction
       |
       v
Jinni agent
       |
       v
AIP intent parser
       |
       v
Intent validator
       |
       v
Commerce provider
       |
       v
AIP authorization engine
       |
       v
Authorization decision
       |
       v
Intent receipt
```

## Technology stack

- React
- Vite
- JavaScript
- Express.js
- SerpApi / Google Shopping
- CSS
- Node.js

## Getting started

### Prerequisites

- Node.js with npm
- A SerpApi API key for live shopping search

### Installation

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd YOUR_PROJECT_FOLDER
npm install
```

Create a `.env` file in the project root:

```env
API_PORT=3001
SERPAPI_KEY=your_serpapi_key
```

Start the backend in one terminal:

```bash
npm run server
```

Start the frontend in another terminal:

```bash
npm run dev
```

Open the local URL printed by Vite.

### API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check backend health and API configuration |
| GET | `/api/commerce/search?q=coding%20laptop` | Retrieve live shopping results |

## Security and limitations

- Never commit `.env` or API credentials.
- Authorization decisions are not proof that a payment or purchase occurred.
- Shopping listings may contain incomplete or inaccurate product information.
- Product specifications must be independently verified before claiming that a product meets all user requirements.
- The current rate limiter is in-memory and is intended for development or limited single-instance use.
- A production implementation needs server-side authorization enforcement, durable receipt storage, stronger authentication, and appropriate payment-provider integration.

## Roadmap

- Formalize the AIP schema and protocol specification.
- Add automated tests for intent validation and authorization.
- Verify product requirements against reliable product data.
- Add signed, tamper-evident intent receipts.
- Build a documented developer SDK.
- Explore payment-provider integrations, including PayPal, with proper authorization and sandbox testing.

## Contributing

Contributions, issues, tests, documentation, and protocol design discussions are welcome. Please open an issue before making large or breaking changes.

## Project status

**Early-stage prototype.** The project explores intent validation and transaction authorization for AI agents. It is not yet a production-ready payment authorization or transaction execution system.

## License

Choose and add an open-source license before inviting contributions. For example, MIT, Apache-2.0, or another license appropriate to your goals.
