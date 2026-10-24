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

## HTTPS Deployment

`backend/nginx.conf` serves plain HTTP on port 8080 for local development. Logins send the password in the request body, so any public deployment must terminate TLS. `backend/nginx.tls.conf.example` is a starting point: it redirects port 80 to HTTPS, serves 443 with TLS 1.2/1.3, and sends an HSTS header.

1. Copy it to `backend/nginx.tls.conf` and replace `uniloop.example.com` with your domain.
2. Put the certificate and key at `backend/certs/fullchain.pem` and `backend/certs/privkey.pem`.
3. Point `BASE_URL`, `ALLOWED_ORIGINS`, and the frontend `VITE_API_URL` at the `https://` origin. The chat client switches to `wss://` automatically.
4. Mount the config and certificates with a Compose override, for example `backend/docker-compose.tls.yml`. Compose merges volumes by container path, so this replaces the HTTP config:

```yaml
services:
  nginx:
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.tls.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
```

```bash
docker compose --env-file backend/.env -f backend/docker-compose.yml -f backend/docker-compose.tls.yml up -d
```

The example starts with a one-year HSTS `max-age`. If you are switching an existing site to HTTPS, try a short value first, and only add `includeSubDomains` once every subdomain serves HTTPS.

## Security Notes

- Do not commit `.env` files or uploaded media.
- Use a strong `JWT_SECRET` in non-local environments.
- Serve the app over HTTPS in any non-local environment (see HTTPS Deployment).
- Keep production SMTP credentials out of Git.
- WebSocket authentication uses the `Sec-WebSocket-Protocol` header instead of URL query tokens.
- Avatar uploads are validated by extension and file header.

## License

No license has been selected yet.
