# UniLoop

UniLoop is a campus second-hand marketplace for students. It includes a user-facing React app, an admin React app, and a Go backend split into auth, core, notification, database, Redis, RabbitMQ, Nginx, and Mailpit services.

## Features

- Student registration and login with JWT authentication
- Email OTP flow with `.edu.my` registration enforcement
- Product listing, search, detail, upload, edit, and image handling
- User profiles and avatar upload
- Favorites, reports, and admin moderation
- Conversations and WebSocket chat
- Location selection through an external map search service
- Docker Compose backend stack for local development

## Tech Stack

- Frontend: React, Vite, Tailwind CSS
- Admin: React, Vite, Tailwind CSS
- Backend: Go, Gin, PostgreSQL, Redis, RabbitMQ
- Reverse proxy: Nginx
- Local email testing: Mailpit
- Container runtime: Docker Compose

## Project Structure

```text
.
├── admin/                  # Admin dashboard
├── backend/                # Go backend and Docker Compose stack
│   ├── cmd/server/         # Monolith entrypoint
│   ├── internal/           # Backend domains, handlers, services, repositories
│   ├── migrations/         # PostgreSQL migrations
│   └── services/           # Auth, core, and notification service entrypoints
├── scripts/                # Local backend stack helpers
└── src/                    # User-facing React app
```

## Requirements

- Node.js 18+
- Go 1.22+
- Docker Compose v2

## Environment Setup

Create local environment files from the examples:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

The backend example file is configured for Docker Compose, so service hosts use Compose service names such as `db`, `rabbitmq`, `redis`, and `mailpit`. Before deploying anywhere public, replace at least:

- `JWT_SECRET`
- `POSTGRES_PASSWORD`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- SMTP settings
- public `BASE_URL` and allowed origins

Local secret files such as `.env`, `backend/.env`, build output, uploads, dependencies, and `docs/` are ignored by Git.

If you run the Go monolith directly on the host instead of through Docker Compose, change `DATABASE_URL`, `RABBITMQ_URL`, `REDIS_URL`, and `SMTP_HOST` in `backend/.env` from service names to `localhost`.

## Run Locally

Install frontend dependencies:

```bash
npm install
```

Start the backend stack and user-facing frontend:

```bash
npm run dev
```

The `predev` script starts the backend stack through Docker Compose before Vite starts.

Useful local URLs:

- User app: `http://localhost:5173`
- Backend gateway: `http://localhost:8080`
- Mailpit UI: `http://localhost:8025`
- RabbitMQ UI: `http://localhost:15672`

Stop or remove the backend stack:

```bash
npm run stack:stop
npm run stack:down
```

## Admin App

Run the admin dashboard separately:

```bash
cd admin
npm install
npm run dev
```

Use the admin credentials configured in `backend/.env`.

## Backend

Run backend tests:

```bash
cd backend
go test ./...
```

Run the Go monolith directly:

```bash
cd backend
make run
```

For this mode, make sure `backend/.env` points to host ports such as `localhost:5432`, `localhost:5672`, `localhost:6379`, and `localhost:1025`.

Build the Go server binary:

```bash
cd backend
make build
```

## Docker Compose

The backend stack is defined in `backend/docker-compose.yml` and includes:

- `db`
- `redis`
- `rabbitmq`
- `auth-service`
- `core-service`
- `notification-service`
- `nginx`
- `mailpit`

Build and start the full stack manually:

```bash
docker compose --env-file backend/.env -f backend/docker-compose.yml up -d --build
```

## Security Notes

- Do not commit `.env` files or uploaded media.
- Use a strong `JWT_SECRET` in non-local environments.
- Keep production SMTP credentials out of Git.
- WebSocket authentication uses the `Sec-WebSocket-Protocol` header instead of URL query tokens.
- Avatar uploads are validated by extension and file header.

## License

No license has been selected yet.
