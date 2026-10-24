# API examples

All application routes are under `/api/v1`. Register at `POST /auth/register` with `email`, `password` (12–128 characters), and `fullName`; login uses `email` and `password`. Both return a bearer token. Send it as `Authorization: Bearer <accessToken>`. `GET /auth/me` returns the profile and `DELETE /auth/session` revokes the current token.

Guests and staff can update their own profile name and phone with `PATCH /api/v1/auth/me` using the bearer token and JSON such as `{"fullName":"Taylor Guest","phone":"+1 555 0100"}`. Email addresses are read-only in this workflow.

Change a password with `PUT /api/v1/auth/password` and JSON `{"currentPassword":"<current>","newPassword":"<new-password-at-least-12-characters>"}`. This revokes all active sessions, so the user must sign in again.

Public search example:

```http
GET /api/v1/hotels?city=Siem%20Reap&checkIn=2026-12-10&checkOut=2026-12-12&guests=2
```

Create an inventory hold with `POST /reservations` and the bearer token:

```json
{"hotelId":"<uuid>","checkIn":"2026-12-10","checkOut":"2026-12-12","guests":2,"roomIds":["<physical-room-uuid>"],"idempotencyKey":"<unique-client-key>"}
```

The API calculates totals and nightly rates on the server. This creates an inventory hold; the first checkout attempt extends it to cover the hosted checkout session.

Start Stripe-hosted checkout with `POST /api/v1/reservations/{reservationId}/checkout`. The response contains `checkoutUrl`; redirect the browser there. Reservation confirmation comes from the signed Stripe webhook, not the browser redirect. Guests can query `GET /api/v1/reservations/{reservationId}` and cancel an eligible booking with `POST /api/v1/reservations/{reservationId}/cancel`.

Hotel operators register through `POST /api/v1/hotels` while signed in. The hotel remains pending until an administrator approves it. Managers edit inventory and prices under `/api/v1/manager/hotels/{hotelId}`; receptionists use `/api/v1/reception/hotels/{hotelId}` for arrivals and stay operations. Each staff endpoint checks both role and hotel assignment.

Guests can view their in-app inbox with `GET /api/v1/notifications` and mark an item read with `PATCH /api/v1/notifications/{id}/read`. Managers upload a hotel photo as multipart form data to `POST /api/v1/manager/hotels/{hotelId}/images`, with a `file` part and optional `altText`. Accepted files are JPEG, PNG, or WebP up to 10 MB. Image upload requires S3 settings; approved hotel detail responses include public image URLs.

Guests can read a reservation summary at `GET /api/v1/reservations/{reservationId}/summary`. The response includes hotel and stay details, room lines, and the nightly price snapshots saved when the reservation was created. Guests can only read their own reservations.
