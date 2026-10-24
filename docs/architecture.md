# Architecture and initial domain design

## Backend package layout

The backend is organized by feature, with each feature keeping related layers together:

```text
com.stayease
├── admin/{controller,dto}
├── auth/{controller,dto,service}
├── hotel/{controller,dto,entity,repository,service,storage}
├── notification/{controller,service}
├── payment/{controller,service}
├── reception/controller
├── reservation/{controller,dto,entity,service}
├── common/{config,controller,exception}
└── StayEaseApplication.java
```

`common` holds cross-cutting Spring configuration, health endpoints, and API exception mapping. Feature-local DTOs contain validated request and response records; repositories stay beside the feature entities they persist.

## Decisions

* Versioned REST API and modular Spring Boot monolith: booking invariants and inventory locking stay transactionally close, with provider boundaries isolated behind ports.
* PostgreSQL UUID identifiers, UTC instants, `date` for stay dates, and `numeric(19,4)` for currency-safe amounts. Currency is stored explicitly.
* Guest sign-in uses random opaque 384-bit bearer tokens. Only SHA-256 hashes are persisted; sessions expire after 12 hours and can be revoked. Passwords use BCrypt.
* RoomType describes sellable inventory and default capacity; Room is a physical unit. ReservationRoom binds a specific physical room and records nightly rate snapshots. No reservation exists without exactly one guest and at least one line.
* PostgreSQL `daterange` exclusion constraint rejects intersecting active room assignments. Holds expire and are transitioned by a scheduled worker; payment calls are not made inside database transactions.
* Reservation/payment orchestration uses idempotency keys and durable records. A verified Stripe `payment_intent.succeeded` event must match the reservation metadata, amount, and currency before confirmation. Webhook event IDs are unique. Late successful payments queue an idempotent compensating refund.
* The reservation stores a cancellation-policy snapshot. Guest cancellations calculate refunds from that snapshot; refund requests run through a retryable reconciliation table and never accept client-supplied amounts.
* Reservation hold, confirmation, and cancellation notifications are written transactionally to an in-app inbox and email outbox. The email worker claims rows with `SKIP LOCKED`, uses provider idempotency keys, retries with backoff, and expires stale work.
* Hotel photo uploads are manager-scoped, size-limited, and checked against file signatures before storage. S3-compatible storage is optional at startup; approved hotel detail endpoints serve uploaded photos.
* Staff authorization checks hotel assignment in application services in addition to role checks. Never trust hotel IDs or prices supplied by a browser.

## Core relationships

`User ↔ Role`; `Hotel ↔ HotelStaff ↔ User`; `Hotel → RoomType → Room`; `Hotel ↔ Amenity`, `Hotel → HotelImage`; `Reservation → guest(User), ReservationRoom → Room`; `Reservation → Payment, Cancellation, CheckInRecord, StatusHistory, Notification`; `RoomType → PricingRule`; `Hotel → CancellationPolicy`; `User/Hotel/Reservation → AuditLog`.

The Flyway migrations create identity, hotel/inventory, pricing, policy, reservation, payment, cancellation/refund, operations, notification and audit tables. Each reservation has exactly one guest FK, and a deferred PostgreSQL constraint trigger enforces at least one reservation-room line at commit. JPA handles standard hotel reads; JDBC is used where explicit row locks, exclusion constraints, and transactional workflow updates are needed. S3 and email adapters activate only when their provider settings are supplied.

## State transitions

Allowed transitions are centralized in the domain state machine. CREATED→PENDING_PAYMENT/EXPIRED/CANCELLED; PENDING_PAYMENT→CONFIRMED/EXPIRED/CANCELLED; CONFIRMED→CHECKED_IN/CANCELLED; CHECKED_IN→CHECKED_OUT; CHECKED_OUT→COMPLETED. Terminal states cannot be checked in. Completed bookings are excluded from ordinary cancellation. Payment-backed transitions require verified authorization.

## Production follow-up

Configure Stripe API and webhook secrets, email provider, S3-compatible bucket and credentials, TLS termination, secret manager, CORS origins, rate limits, operational metrics, reconciliation alerting, retention, and tested backup/restore.
