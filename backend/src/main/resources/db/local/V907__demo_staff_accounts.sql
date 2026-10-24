-- Local/demo data only (db/local never loads outside the local profile). Sign-in accounts for every role so the
-- staff consoles can be tried without an administrator setting them up. All four share the password
-- StayEase-Demo-2026 (BCrypt, strength 12, as the API hashes it).
--   admin@stayease.local      System administrator
--   manager@stayease.local    Hotel manager of Lotus Lantern Residence (Siem Reap) and Mekong Riverside Suites (Phnom Penh)
--   reception@stayease.local  Receptionist at Lotus Lantern Residence
--   guest@stayease.local      Guest
-- An address someone already registered locally keeps its own password and only gains the role.
INSERT INTO app_user(id,email,password_hash,full_name) VALUES
  ('30000000-0000-4000-8000-000000000001','admin@stayease.local','$2a$12$b0rQa5NteMXc6StLzVRGe.FrviSsDsSKxRKdi3jKfaNZVl2Wt8h82','Sokha Admin'),
  ('30000000-0000-4000-8000-000000000002','manager@stayease.local','$2a$12$b0rQa5NteMXc6StLzVRGe.FrviSsDsSKxRKdi3jKfaNZVl2Wt8h82','Dara Manager'),
  ('30000000-0000-4000-8000-000000000003','reception@stayease.local','$2a$12$b0rQa5NteMXc6StLzVRGe.FrviSsDsSKxRKdi3jKfaNZVl2Wt8h82','Channy Reception'),
  ('30000000-0000-4000-8000-000000000004','guest@stayease.local','$2a$12$b0rQa5NteMXc6StLzVRGe.FrviSsDsSKxRKdi3jKfaNZVl2Wt8h82','Vanna Guest')
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_role(user_id,role)
SELECT u.id,r.role FROM (VALUES
  ('admin@stayease.local','SYSTEM_ADMIN'),
  ('manager@stayease.local','GUEST'),('manager@stayease.local','HOTEL_MANAGER'),
  ('reception@stayease.local','GUEST'),('reception@stayease.local','RECEPTIONIST'),
  ('guest@stayease.local','GUEST')
) AS r(email,role) JOIN app_user u ON u.email=r.email
ON CONFLICT DO NOTHING;

INSERT INTO hotel_staff(hotel_id,user_id,staff_role)
SELECT s.hotel_id::uuid,u.id,s.staff_role FROM (VALUES
  ('10000000-0000-4000-8000-000000000001','manager@stayease.local','HOTEL_MANAGER'),
  ('10000000-0000-4000-8000-000000000002','manager@stayease.local','HOTEL_MANAGER'),
  ('10000000-0000-4000-8000-000000000001','reception@stayease.local','RECEPTIONIST')
) AS s(hotel_id,email,staff_role) JOIN app_user u ON u.email=s.email
ON CONFLICT DO NOTHING;
