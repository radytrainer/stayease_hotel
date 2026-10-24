# StayEase

Hotel booking platform for Cambodia. Guests search live availability in all 25 provinces, hold rooms at a fixed price and pay online (Stripe) or at the hotel. Hotel managers, receptionists and administrators each get their own workspace.

| Part | Technology | Port |
| --- | --- | --- |
| Web app | Next.js 16, React 19, TypeScript, Tailwind CSS | 3000 |
| API | Java 21, Spring Boot 3.5, Spring Security | 8080 |
| Database | PostgreSQL 18 with Flyway migrations | 5432 |

## Team

**Group #3 · OOAD project**

| Member |
| --- |
| Rady Y |
| Sarath Orn |
| Vetou Sim |
| Chhanghong Try |
| Kimseng Sihong |

## Contents

1. [Quick start with Docker](#1-quick-start-with-docker)
2. [Sign in with the demo accounts](#2-sign-in-with-the-demo-accounts)
3. [Configuration](#3-configuration)
4. [Run without Docker (development)](#4-run-without-docker-development)
5. [Tests](#5-tests)
6. [Everyday commands](#6-everyday-commands)
7. [Project structure](#7-project-structure)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Quick start with Docker

This is the easiest way to run the whole system: database, API and web app with one command.

**You need:** [Git](https://git-scm.com/downloads) and [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running).

#### Step 1. Get the code

```bash
git clone https://github.com/radytrainer/stayease_hotel.git
cd stayease_hotel
```

#### Step 2. Create your settings file

```bash
cp .env.example .env
```

On Windows Command Prompt use `copy .env.example .env`. Open `.env` and change `POSTGRES_PASSWORD`. Everything else can stay empty for a first run (see [Configuration](#3-configuration)).

#### Step 3. Start everything

```bash
docker compose up --build
```

The first build downloads and compiles everything and takes a few minutes. The API runs the database migrations and loads demo data on start-up; the web app starts once the API is healthy.

#### Step 4. Open the app

| What | Address |
| --- | --- |
| Website | <http://localhost:3000> |
| API health check | <http://localhost:8080/api/v1/health> |
| API documentation (Swagger) | <http://localhost:8080/swagger-ui.html> |

Stop with `Ctrl+C`, or run `docker compose down` from another terminal.

## 2. Sign in with the demo accounts

Docker starts the API with the `local` profile, which loads 146 demo hotels across Cambodia and one account per role. All demo accounts use the password **`StayEase-Demo-2026`**.

| Email | Role | What to try |
| --- | --- | --- |
| `guest@stayease.local` | Guest | Search, book a room, pay at hotel, cancel, print a receipt |
| `manager@stayease.local` | Hotel manager | Workspace: rooms, rates, policy, photos, promo codes, reports (Lotus Lantern Residence, Mekong Riverside Suites) |
| `reception@stayease.local` | Receptionist | Workspace: arrivals, check-in, check-out, mark payments received (Lotus Lantern Residence) |
| `admin@stayease.local` | Administrator | Workspace: approve hotels, users, staff assignments, platform promotions |

Demo data exists only in the `local` profile. In production, the first administrator is created from `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`.

## 3. Configuration

All settings live in `.env` (copied from `.env.example`). **Never commit `.env`.** After changing it, restart with `docker compose up --build`.

### Required

| Setting | Purpose |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database name and login |
| `WEB_ORIGIN` | Address of the web app, allowed by the API (default `http://localhost:3000`) |

### Optional features

Each feature below stays off until its settings are filled in. The rest of the system works without them.

#### Online card payment (Stripe)

1. Create a free account at [stripe.com](https://stripe.com) and switch to **Test mode**.
2. Copy the secret key (`sk_test_...`) into `STRIPE_SECRET_KEY`.
3. For local testing, install the [Stripe CLI](https://docs.stripe.com/stripe-cli) and run:
   ```bash
   stripe listen --forward-to localhost:8080/api/v1/payments/webhooks/stripe
   ```
   Copy the printed signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET` and keep the command running.
4. In production, add a webhook endpoint in the Stripe dashboard for `https://<your-api>/api/v1/payments/webhooks/stripe` with the events `payment_intent.succeeded` and `payment_intent.payment_failed`, and use its signing secret.
5. Test with card `4242 4242 4242 4242`, any future date and any CVC.

Without Stripe keys, guests can still book with **Pay at hotel**.

#### Booking emails (Resend or a compatible API)

| Setting | Value |
| --- | --- |
| `EMAIL_API_KEY` | API key from [resend.com](https://resend.com) |
| `EMAIL_FROM` | A sender address on a domain you verified, e.g. `StayEase <bookings@example.com>` |

Without these, notifications still appear in the in-app inbox.

#### Hotel photo uploads (Amazon S3 or an S3-compatible service)

| Setting | Value |
| --- | --- |
| `S3_BUCKET`, `S3_REGION` | Bucket name and region |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Access key pair with read/write rights on the bucket |
| `S3_ENDPOINT` | Only for S3-compatible providers (MinIO, Cloudflare R2, ...) |

#### First administrator (for a fresh database without demo data)

Set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` (at least 12 characters) before the first start.

#### Other settings

| Setting | Purpose |
| --- | --- |
| `KHR_PER_USD`, `KHR_RATE_PUBLISHED_ON` | Riel exchange rate used to display prices in KHR |
| `FORWARD_HEADERS_STRATEGY` | Set to `native` only behind a trusted reverse proxy |
| `UNSPLASH_ACCESS_KEY` | Only for `scripts/unsplash-demo-photos.mjs`, which builds demo photo data |

## 4. Run without Docker (development)

Use this when you change code and want fast reloads.

**You need:** Java 21, Maven 3.9+, Node.js 20.9+ and a PostgreSQL 18 server (you can run only the database in Docker).

#### Step 1. Start the database

```bash
docker compose up -d db
```

#### Step 2. Start the API (in a new terminal)

```bash
cd backend
SPRING_PROFILES_ACTIVE=local mvn spring-boot:run
```

On Windows PowerShell: `$env:SPRING_PROFILES_ACTIVE="local"; mvn spring-boot:run`. The API connects to `localhost:5432` with the default user `stayease` / password `local-only`; if your `.env` sets another password, also set `SPRING_DATASOURCE_PASSWORD`.

#### Step 3. Start the web app (in another terminal)

```bash
cd frontend
npm install
echo NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1 > .env.local
npm run dev
```

Open <http://localhost:3000>. Pages reload as you save files.

## 5. Tests

| Part | Command | Notes |
| --- | --- | --- |
| API | `cd backend && mvn test` | Docker must be running: integration tests start a real PostgreSQL container (Testcontainers) |
| Web | `cd frontend && npm run lint` | TypeScript type check |
| Web | `cd frontend && npm run build` | Production build |

The API tests cover double-booking races, hold expiry, frozen prices, Stripe webhook signatures and refunds, pay at hotel, promo code rules, role-based access (401/403) and backup/restore.

## 6. Everyday commands

| Task | Command |
| --- | --- |
| Start in the background | `docker compose up -d --build` |
| Follow the logs | `docker compose logs -f api` (or `web`, `db`) |
| Stop | `docker compose down` |
| Rebuild one part after a code change | `docker compose up -d --build web` |
| **Reset the database** (deletes all data, reloads demo data) | `docker compose down -v` then `docker compose up --build` |
| Back up the database | `docker compose exec db pg_dump -U stayease -Fc stayease > stayease.dump` |
| Restore a backup | `docker compose exec -T db pg_restore -U stayease --clean --if-exists -d stayease < stayease.dump` |

## 7. Project structure

```text
stayease/
├─ docker-compose.yml      database, API and web app
├─ .env.example            settings template
├─ backend/                Spring Boot API
│  └─ src/main/java/com/stayease/
│     ├─ auth/             sign-in, sessions, rate limiting
│     ├─ hotel/            search, hotel registration, manager workspace
│     ├─ reservation/      booking, holds, cancellation
│     ├─ payment/          Stripe, webhooks, refunds, pay at hotel
│     ├─ promotion/        hotel and platform promo codes
│     ├─ reception/        arrivals, check-in, check-out
│     ├─ admin/            approvals, users, staff
│     ├─ notification/     in-app inbox, email outbox
│     └─ common/           security, errors, health
│  └─ src/main/resources/db/
│     ├─ migration/        database schema (Flyway)
│     └─ local/            demo data, local profile only
├─ frontend/               Next.js web app
│  ├─ app/                 pages, one folder per URL
│  ├─ components/          header, footer, UI kit, staff workspaces
│  └─ lib/                 API client, session, English/Khmer text
└─ docs/                   architecture notes, API examples, screenshots
```

More detail: [docs/architecture.md](docs/architecture.md) and [docs/api-examples.md](docs/api-examples.md).

## 8. Troubleshooting

| Problem | Fix |
| --- | --- |
| `port is already allocated` | Another program uses 3000, 8080 or 5432. Stop it, or change the left-hand port in `docker-compose.yml` (e.g. `"3001:3000"`) |
| Website says it cannot reach StayEase | The API is still starting (about 30 s). Check `docker compose logs -f api` |
| Login fails after changing `POSTGRES_PASSWORD` | The database kept the old password. Reset it with `docker compose down -v` (deletes data) |
| No demo hotels | The API must run with `SPRING_PROFILES_ACTIVE=local` (Docker does this for you) |
| **Pay online** button missing | Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, then restart |
| Payment stays "Confirming" | The webhook is not arriving. Keep `stripe listen` running and check the `whsec_` secret matches |
| `mvn test` fails at start | Docker is not running; the tests need it for PostgreSQL |
| Signed in on one tab but not another | By design: sessions are kept per browser tab and end when the tab closes |
