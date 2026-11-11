# StockPilot WMS Project Rules

Read this file and docs/StockPilot_Specification.pdf before changing code.

## Stack and versions
- Node.js >= 22.12, ES modules.
- Server: Express 5, Mongoose 9, Zod 4, Vitest 5, Supertest.
- Client: React 19, Vite 8, Tailwind CSS 4, React Router 7, TanStack Query 5, Axios.
- Do not generate Express 4, Zod 3 or CommonJS code.

## Mandatory code standards
- Every file starts with the license header comment used in existing files.
- Every exported function, class and method has a JSDoc block with @param, @returns and @throws.
- No inline comments, no commented-out code, no console.log.
- Follow the module structure of server/src/modules/categories exactly.
- Request flow: route -> validate middleware -> controller -> service -> model.
- Controllers contain no business logic. Services contain no HTTP objects.
- Use ApiError for expected failures and sendSuccess for responses.
- Read validated input from req.validated.
- Money is integer minor units. Quantities have at most 3 decimals.
- All stock changes go through the stock posting service. Never write stock
  collections anywhere else.
- Multi-document writes use MongoDB transactions.

## Working agreement
1. Produce a written plan listing files to create or change, and wait for approval.
2. Implement only the approved scope of the current phase.
3. Never invent class names or method signatures: read existing files first.
4. Add tests for each endpoint and business rule.
5. Run npm run lint and npm test (server), npm run lint and npm run build (client)
   and report the real results.
6. Never modify .env files or print secrets.
7. At the end, list every file created or changed and open questions.
