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
9. [Deploy to AWS (EC2)](#9-deploy-to-aws-ec2)

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

### Run everything with one command

```bash
docker compose up -d --build     # the smoke test needs the app running
node scripts/test-all.mjs
```

It runs the steps below in order and prints a PASS/FAIL summary. Options: `--quick` skips the backend suite, `--no-smoke` skips the smoke test, `--no-build` skips the production build, `--no-install` skips `npm ci`.

| Step | Command | What it checks |
| --- | --- | --- |
| Backend tests | `cd backend && mvn test` | Unit and PostgreSQL integration tests: double-booking races, hold expiry, frozen prices, Stripe webhooks and refunds, pay at hotel, promo codes, 401/403 access rules, backup/restore. Docker must be running (Testcontainers) |
| Frontend type check | `cd frontend && npm run lint` | TypeScript errors |
| Frontend build | `cd frontend && npm run build` | The production build succeeds |
| Smoke test | `node scripts/smoke-test.mjs` | 26 end-to-end checks against the running app (below) |

### End-to-end smoke test

`scripts/smoke-test.mjs` drives the real API the way the web app does, using the demo accounts:

1. Public search and destinations
2. Sign-in for all four roles, and rejection of a wrong password
3. Access control: 401 without a token, 403 for the wrong role
4. A booking: free room, 15-minute hold, same idempotency key returns the same booking, a second guest gets 409 for the same room, other guests cannot read it
5. Pay at hotel confirms the booking
6. The receptionist sees the arrival with an amount to collect; the manager report loads
7. Cancellation frees the room and notifications arrive
8. Sign-out ends the session

Bookings use random dates 300–700 days ahead and are cancelled at the end, so the test can run any number of times. To test another server: `API_URL=https://your-server/api/v1 node scripts/smoke-test.mjs`.

### Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request on GitHub: backend tests, frontend type check and build, then the smoke test against a fresh `docker compose` stack. Results appear in the repository's **Actions** tab.

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
├─ docker-compose.prod.yml production stack behind Caddy (see section 9)
├─ deploy/                 server setup, deploy and backup scripts, Caddyfile
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

## 9. Deploy to AWS (EC2)

The whole stack runs on one EC2 instance with Docker. [Caddy](https://caddyserver.com) is the only container reachable from outside: it sends `/api/*` to the API and everything else to the web app, so the browser talks to a single address. The database and app ports stay private.

```text
browser ──► :80 Caddy ──► /api/*  ──► api:8080 ──► db:5432
                     └──► others  ──► web:3000
```

Current server: **http://3.107.7.2**

#### Step 1. Prepare the instance (once)

- **Instance:** Ubuntu 24.04 or Amazon Linux 2023, at least `t3.small` (2 GB). The setup script adds 4 GB of swap below 4 GB of memory so the builds fit. 20 GB disk.
- **Security group inbound rules:** SSH `22` from your own IP only, HTTP `80` from anywhere (`443` too once you use a domain). Do **not** open 3000, 8080 or 5432.
- **Elastic IP:** attach one so `3.107.7.2` survives a stop/start; otherwise the address changes and you must update `PUBLIC_URL` and rebuild.

```bash
ssh -i your-key.pem ubuntu@3.107.7.2          # ec2-user@ on Amazon Linux
git clone https://github.com/radytrainer/stayease_hotel.git stayease
cd stayease
bash deploy/setup-server.sh                    # installs Docker, adds swap
exit                                           # log in again so the docker group applies
```

#### Step 2. Create the production settings

```bash
cd stayease
cp deploy/env.production.example .env
openssl rand -base64 24                        # paste the result into POSTGRES_PASSWORD
nano .env
```

Fill in `POSTGRES_PASSWORD` and either:

- `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` for a real, empty system, or
- `SPRING_PROFILES_ACTIVE=local` for a demo server with the demo hotels and accounts from section 2.

Choose before the first start; switching later needs a fresh database (`docker compose -f docker-compose.prod.yml down -v`). The optional Stripe, email and S3 settings work as described in section 3.

#### Step 3. Start it

```bash
bash deploy/deploy.sh
```

The first build takes 5–10 minutes. The script waits until the site answers and then prints `StayEase is up at http://3.107.7.2`. Check it from your own computer with `API_URL=http://3.107.7.2/api/v1 node scripts/smoke-test.mjs` (demo data only).

#### Updating

```bash
cd stayease && bash deploy/deploy.sh --pull     # git pull, rebuild, restart
```

#### Operations

| Task | Command (in `~/stayease`) |
| --- | --- |
| Status | `docker compose -f docker-compose.prod.yml ps` |
| Logs | `docker compose -f docker-compose.prod.yml logs -f api` (or `web`, `proxy`, `db`) |
| Back up now | `bash deploy/backup-db.sh` (to `~/stayease-backups`, newest 14 kept) |
| Daily backup at 02:00 | `crontab -e`, add `0 2 * * * bash $HOME/stayease/deploy/backup-db.sh` |
| Stop | `docker compose -f docker-compose.prod.yml down` (data is kept) |

Copy backups off the server too (for example `aws s3 cp` to a bucket), since they are lost with the instance.

#### HTTPS with a domain

On the bare IP the site is plain HTTP. Passwords and session tokens then cross the network unencrypted, and Stripe needs an `https://` webhook URL for live payments. To fix this, point a domain's DNS `A` record at the Elastic IP, open port `443`, and set in `.env`:

```text
SITE_ADDRESS=stayease.example.com
PUBLIC_URL=https://stayease.example.com
```

Then run `bash deploy/deploy.sh`. Caddy obtains and renews the Let's Encrypt certificate automatically. `PUBLIC_URL` is built into the web app, so any change to it needs this rebuild.
