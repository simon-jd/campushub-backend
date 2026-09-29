# CampusHub Backend

The CS 5500 semester-project backend, built with TypeScript, Express, and Mongoose.

## Current Status

Lab 1 initialization and context rules are complete, and the user has approved [AGENTS.md](AGENTS.md).
The Express application, startup entry point, and layered health check are implemented and verified through actual HTTP requests in both development and compiled execution.
**The user has reviewed the generated code and confirmed that there are no concerns.** Human review was recorded separately from automated verification.

## Requirements and Installation

- Node.js `>=24.21.0`
- npm `>=11.19.1`
- Install from the repository: `npm ci`
- Create local configuration: `cp .env-example .env` (preserve an existing `.env` file)

Dependencies use exact versions and a lockfile. TypeScript uses the tooling-supported 5.9 series.
MongoDB does not need to be running at this stage.

## Commands

| Command                | Purpose                                               | Availability              |
| ---------------------- | ----------------------------------------------------- | ------------------------- |
| `npm run typecheck`    | Strict type checking                                  | Available                 |
| `npm run lint`         | Check types, Promises, and selected import boundaries | Available                 |
| `npm run format:check` | Check formatting                                      | Available                 |
| `npm run format`       | Apply formatting                                      | Available                 |
| `npm run check`        | Run the first three checks                            | Available                 |
| `npm run build`        | Compile `src/` into `dist/`                           | Available                 |
| `npm run dev`          | Run and watch `src/server.ts`                         | Available                 |
| `npm start`            | Run `dist/server.js`                                  | Run `npm run build` first |

These checks do not replace actual HTTP testing or human review.

## Running and Verifying

Run `npm run dev` from the project directory, then run this in another terminal:

```sh
curl -i http://127.0.0.1:3000/api/v1/health
```

Expected HTTP status: `200`. Example JSON (the timestamp is generated on each request):

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-09-29T02:11:15.534Z"
  }
}
```

Unknown paths return HTTP `404`:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested resource was not found."
  }
}
```

The server listens only on local address `127.0.0.1`. `PORT` defaults to `3000`; set it in `.env` or override it through the environment.
The port must be an integer from `1–65535`. Invalid values or an occupied port produce a clear error and a nonzero application exit status.
`npm start` exits with the application. The parent watcher used by `npm run dev` keeps waiting for file changes; stop it with Ctrl+C.
To verify the compiled entry point, stop the development process with Ctrl+C, then run `npm run build` and `npm start`.
The health check indicates HTTP service liveness, not database or dependency readiness. No running MongoDB instance is required.

## Structure

```text
src/
├── app.ts        Express application composition
├── server.ts     Configuration validation and listener startup
├── routes/       Path and middleware mappings
├── controllers/  HTTP request and response handling
├── services/     Business logic and Mongoose queries
├── models/       Mongoose schemas and data definitions
├── middleware/   Consistent 404 and error handling
├── interfaces/   Data and function contracts
└── types/        Type declarations
```

`src/app.ts` composes the application; `src/server.ts` reads configuration and starts the listener.
See [AGENTS.md](AGENTS.md) for detailed boundaries, the dependency allowlist, and acceptance requirements.

Services exclusively own persistence reads and writes. The Repository pattern is not currently used.
Controllers return `{ success: true, data: ... }` on success and
`{ success: false, error: { code, message } }` on failure, with the appropriate HTTP status code.
Health follows Route → Controller → Service and declares a response data interface; the Service only returns status and timestamp.

## Human Review

The user has reviewed and approved both the rules and generated code.
Suggested reading order: `interfaces/` → `services/health.service.ts` →
`controllers/health.controller.ts` → `routes/health.routes.ts` → `middleware/` → `app.ts` → `server.ts`.
Review layering, types, response formats, error forwarding, and the minimal Service implementation.
The process and observed results are recorded in the [Lab 1 verification record](docs/lab1-verification.md).
