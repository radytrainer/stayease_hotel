-- Local/demo data only. Approximate map pins for the fictional demo hotels: each sits within ~500 m of its
-- provincial capital, spread deterministically by hotel id. In coastal towns the spread only moves inland (north)
-- so pins stay on land. Capital coordinates: Wikipedia/Wikidata entries for each provincial capital.
WITH capital(city, lat, lng, coastal) AS (VALUES
  ('Phnom Penh', 11.5564, 104.9282, false),
  ('Siem Reap', 13.3633, 103.8564, false),
  ('Battambang', 13.0957, 103.2022, false),
  ('Preah Sihanouk (Kampong Som, Sihanoukville)', 10.6270, 103.5220, true),
  ('Kampot', 10.6104, 104.1815, true),
  ('Kep', 10.4900, 104.3200, true),
  ('Koh Kong', 11.6153, 102.9838, true),
  ('Mondulkiri (Sen Monorom)', 12.4500, 107.2000, false),
  ('Ratanakiri (Banlung)', 13.7467, 107.0044, false),
  ('Kratie', 12.4881, 106.0188, false),
  ('Kandal (Ta Khmau)', 11.4833, 104.9500, false),
  ('Kampong Cham', 11.9934, 105.4635, false),
  ('Kampong Thom (Stung Sen)', 12.7111, 104.8887, false),
  ('Kampong Speu (Chbar Mon)', 11.4500, 104.5000, false),
  ('Preah Vihear', 13.8076, 104.9800, false),
  ('Stung Treng', 13.5259, 105.9683, false),
  ('Takeo (Doun Kaev)', 10.9833, 104.7833, false),
  ('Pursat', 12.5388, 103.9192, false),
  ('Banteay Meanchey (Serei Saophoan)', 13.5839, 102.9736, false),
  ('Svay Rieng', 11.0878, 105.7993, false),
  ('Kampong Chhnang', 12.2500, 104.6667, false),
  ('Oddar Meanchey (Samraong)', 14.2500, 103.5833, false),
  ('Pailin', 12.8489, 102.6093, false),
  ('Prey Veng', 11.4868, 105.3253, false),
  ('Tbong Khmum (Suong)', 11.9111, 105.8542, false)
), spread AS (
  SELECT h.id, c.lat, c.lng, c.coastal,
         ((abs(hashtext(h.id::text)) % 1000) / 1000.0 - 0.5) AS a,
         ((abs(hashtext(reverse(h.id::text))) % 1000) / 1000.0 - 0.5) AS b
  FROM hotel h JOIN capital c ON c.city = h.city
  WHERE h.id::text LIKE '10000000-0000-4000-8000-%'
)
UPDATE hotel h SET
  latitude  = round((s.lat + CASE WHEN s.coastal THEN abs(s.a) ELSE s.a END * 0.009)::numeric, 6),
  longitude = round((s.lng + s.b * 0.009)::numeric, 6)
FROM spread s WHERE s.id = h.id;
