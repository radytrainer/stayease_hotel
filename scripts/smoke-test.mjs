#!/usr/bin/env node
/**
 * End-to-end smoke test against a running StayEase stack (local profile, demo data loaded).
 *
 *   node scripts/smoke-test.mjs                      # API at http://localhost:8080/api/v1
 *   API_URL=https://staging.example/api/v1 node scripts/smoke-test.mjs
 *
 * Walks the main business flow through the real HTTP API: sign-in for every role, access control,
 * search, a booking with its idempotency and double-booking guards, pay at hotel, the reception desk,
 * cancellation and sign-out. Bookings are made on random far-future dates and cancelled at the end,
 * so repeated runs leave no rooms blocked. Exits 1 if any check fails.
 */
import { randomUUID } from 'node:crypto';

const API = (process.env.API_URL || 'http://localhost:8080/api/v1').replace(/\/$/, '');
const PASSWORD = process.env.DEMO_PASSWORD || 'StayEase-Demo-2026';
const DEMO_HOTEL = 'Lotus Lantern Residence'; // managed by manager@, front desk run by reception@

const color = process.stdout.isTTY ? (c, s) => `\x1b[${c}m${s}\x1b[0m` : (_, s) => s;
let passed = 0, failed = 0;

async function call(method, path, { token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

function expect(condition, message) { if (!condition) throw new Error(message); }
function expectStatus(res, status) {
  expect(res.status === status, `expected HTTP ${status}, got ${res.status}${res.data?.detail ? ` (${res.data.detail})` : ''}`);
}

async function check(name, fn) {
  try { await fn(); passed++; console.log(`  ${color(32, 'PASS')}  ${name}`); }
  catch (e) { failed++; console.log(`  ${color(31, 'FAIL')}  ${name}\n        ${e.message}`); }
}

function section(title) { console.log(`\n${color(1, title)}`); }

function isoDate(daysFromToday) {
  const d = new Date(); d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log(`StayEase smoke test against ${API}`);
  const health = await fetch(`${API}/health`).catch(() => null);
  if (!health?.ok) {
    console.log(color(31, `\nThe API is not reachable at ${API}. Start it first, e.g. "docker compose up -d --build".`));
    process.exit(1);
  }

  const tokens = {};
  const ctx = {};
  // A random window 300-700 days ahead, so runs don't collide with each other or with real bookings.
  const offset = 300 + Math.floor(Math.random() * 400);
  const checkIn = isoDate(offset), checkOut = isoDate(offset + 2);

  section('1. Public pages');
  await check('health endpoint is up', async () => expectStatus(await call('GET', '/health'), 200));
  await check('hotel search returns Siem Reap hotels', async () => {
    const res = await call('GET', '/hotels?city=Siem%20Reap&size=5');
    expectStatus(res, 200);
    expect(Array.isArray(res.data) && res.data.length > 0, 'no hotels returned');
  });
  await check('destinations list hotel counts per province', async () => {
    const res = await call('GET', '/hotels/destinations');
    expectStatus(res, 200);
    expect(res.data.length > 0, 'no destinations returned');
  });

  section('2. Sign-in');
  await check('wrong password is rejected with 401', async () => {
    expectStatus(await call('POST', '/auth/login', { body: { email: 'guest@stayease.local', password: 'wrong-password-123' } }), 401);
  });
  const accounts = { guest: 'GUEST', manager: 'HOTEL_MANAGER', reception: 'RECEPTIONIST', admin: 'SYSTEM_ADMIN' };
  for (const [name, role] of Object.entries(accounts)) {
    await check(`${name}@stayease.local signs in and has role ${role}`, async () => {
      const login = await call('POST', '/auth/login', { body: { email: `${name}@stayease.local`, password: PASSWORD } });
      expectStatus(login, 200);
      tokens[name] = login.data.accessToken;
      const me = await call('GET', '/auth/me', { token: tokens[name] });
      expectStatus(me, 200);
      expect(me.data.roles.includes(role), `roles are ${me.data.roles}`);
    });
  }
  if (Object.keys(tokens).length < 4) {
    console.log(color(31, '\nDemo accounts are missing. Run the API with the local profile (docker compose does this).'));
    return;
  }

  section('3. Access control');
  await check('no token: my bookings returns 401', async () => expectStatus(await call('GET', '/reservations'), 401));
  await check('guest cannot open the admin console (403)', async () => expectStatus(await call('GET', '/admin/users', { token: tokens.guest }), 403));
  await check('receptionist cannot open the manager workspace (403)', async () => expectStatus(await call('GET', '/manager/hotels', { token: tokens.reception }), 403));
  await check('manager cannot run platform promotions (403)', async () => expectStatus(await call('GET', '/admin/promotions', { token: tokens.manager }), 403));

  section(`4. Booking at ${DEMO_HOTEL}, ${checkIn} to ${checkOut}`);
  await check('manager workspace lists the demo hotel', async () => {
    const res = await call('GET', '/manager/hotels', { token: tokens.manager });
    expectStatus(res, 200);
    ctx.hotel = res.data.find(h => h.name === DEMO_HOTEL);
    expect(ctx.hotel, `${DEMO_HOTEL} not found`);
  });
  await check('availability lists a free room with nightly prices', async () => {
    const res = await call('GET', `/hotels/${ctx.hotel.slug}/availability?checkIn=${checkIn}&checkOut=${checkOut}&guests=2`);
    expectStatus(res, 200);
    const option = res.data.find(o => o.available > 0);
    expect(option, 'no free room');
    ctx.roomId = option.roomIds[0];
    expect(option.nightlyRates.length === 2, `expected 2 nightly rates, got ${option.nightlyRates.length}`);
  });
  const key = `smoke-${randomUUID()}`;
  const booking = () => ({ hotelId: ctx.hotel.id, checkIn, checkOut, guests: 2, roomIds: [ctx.roomId], idempotencyKey: key });
  await check('guest holds the room: 201, PENDING_PAYMENT, 15-minute hold', async () => {
    const res = await call('POST', '/reservations', { token: tokens.guest, body: booking() });
    expectStatus(res, 201);
    expect(res.data.status === 'PENDING_PAYMENT', `status ${res.data.status}`);
    expect(Number(res.data.total) > 0, 'total is not positive');
    expect(res.data.holdExpiresAt, 'no hold expiry');
    ctx.reservationId = res.data.id;
  });
  await check('same idempotency key returns the same booking (no duplicate)', async () => {
    const res = await call('POST', '/reservations', { token: tokens.guest, body: booking() });
    expect([200, 201].includes(res.status), `HTTP ${res.status}`);
    expect(res.data.id === ctx.reservationId, 'a second reservation was created');
  });
  await check('another guest cannot book the same room and dates (409)', async () => {
    // The demo manager also holds the GUEST role, so it acts as a second guest here.
    const res = await call('POST', '/reservations', { token: tokens.manager, body: { ...booking(), idempotencyKey: `smoke-${randomUUID()}` } });
    expectStatus(res, 409);
  });
  await check('another guest cannot read this booking (404)', async () => {
    expectStatus(await call('GET', `/reservations/${ctx.reservationId}`, { token: tokens.manager }), 404);
  });

  section('5. Pay at hotel');
  await check('guest chooses pay at hotel: booking CONFIRMED', async () => {
    const res = await call('POST', `/reservations/${ctx.reservationId}/pay-at-hotel`, { token: tokens.guest });
    expectStatus(res, 200);
    const details = await call('GET', `/reservations/${ctx.reservationId}`, { token: tokens.guest });
    expect(details.data.status === 'CONFIRMED', `status ${details.data.status}`);
  });
  await check('guest sees the booking in My trips', async () => {
    const res = await call('GET', '/reservations', { token: tokens.guest });
    expectStatus(res, 200);
    expect(res.data.some(r => r.id === ctx.reservationId), 'booking missing from history');
  });

  section('6. Front desk');
  await check('receptionist sees the guest in arrivals with an amount to collect', async () => {
    const res = await call('GET', `/reception/hotels/${ctx.hotel.id}/arrivals?date=${checkIn}`, { token: tokens.reception });
    expectStatus(res, 200);
    const row = res.data.find(r => r.id === ctx.reservationId);
    expect(row, 'booking missing from arrivals');
    expect(Number(row.amount_due) > 0, 'no amount due');
  });
  await check('manager report for the stay dates loads', async () => {
    expectStatus(await call('GET', `/manager/hotels/${ctx.hotel.id}/reports/overview?from=${checkIn}&to=${checkOut}`, { token: tokens.manager }), 200);
  });

  section('7. Cancellation');
  await check('guest cancels: CANCELLED, nothing owed', async () => {
    const res = await call('POST', `/reservations/${ctx.reservationId}/cancel`, { token: tokens.guest, body: { reason: 'Automated smoke test' } });
    expectStatus(res, 200);
    expect(res.data.status === 'CANCELLED', `status ${res.data.status}`);
    expect(Number(res.data.refundAmount) === 0, `refund ${res.data.refundAmount}`);
  });
  await check('the room is free again for those dates', async () => {
    const res = await call('GET', `/hotels/${ctx.hotel.slug}/availability?checkIn=${checkIn}&checkOut=${checkOut}&guests=2`);
    expect(res.data.some(o => o.roomIds.includes(ctx.roomId)), 'room still blocked');
  });
  await check('guest received in-app notifications', async () => {
    const res = await call('GET', '/notifications', { token: tokens.guest });
    expectStatus(res, 200);
    expect(res.data.length > 0, 'inbox is empty');
  });

  section('8. Sign-out');
  await check('signing out ends the session (then 401)', async () => {
    expectStatus(await call('DELETE', '/auth/session', { token: tokens.guest }), 204);
    expectStatus(await call('GET', '/auth/me', { token: tokens.guest }), 401);
  });
  for (const name of ['manager', 'reception', 'admin']) await call('DELETE', '/auth/session', { token: tokens[name] });
}

main()
  .catch(e => { failed++; console.log(color(31, `\nUnexpected error: ${e.stack || e}`)); })
  .finally(() => {
    console.log(`\n${failed ? color(31, `${failed} failed`) : color(32, 'All checks passed')}, ${passed} passed`);
    process.exit(failed ? 1 : 0);
  });
