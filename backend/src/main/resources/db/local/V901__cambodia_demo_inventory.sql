-- Local/demo data only (db/local). Replaces the original sample hotels with Cambodian ones.
-- V900 is left untouched so already-migrated databases keep a valid Flyway checksum. The IDs of the
-- first three hotels, room types and rooms are kept so any local references stay valid.
-- Hotel names are fictional. Prices are in USD, the currency most Cambodian hotels quote.

UPDATE hotel SET name='Lotus Lantern Residence',slug='lotus-lantern-residence',city='Siem Reap',country='Cambodia',address='No. 18, Wat Bo Road, Sala Kamreuk',description='A calm courtyard hotel a short tuk-tuk ride from Pub Street and 20 minutes from Angkor Wat. Early breakfast is served for sunrise temple visits.',timezone='Asia/Phnom_Penh',updated_at=now() WHERE id='10000000-0000-4000-8000-000000000001';
UPDATE hotel SET name='Mekong Riverside Suites',slug='mekong-riverside-suites',city='Phnom Penh',country='Cambodia',address='No. 112, Sisowath Quay, Daun Penh',description='Riverfront suites facing the Tonle Sap and Mekong confluence, within walking distance of the Royal Palace and Central Market.',timezone='Asia/Phnom_Penh',updated_at=now() WHERE id='10000000-0000-4000-8000-000000000002';
UPDATE hotel SET name='Otres Breeze Bungalows',slug='otres-breeze-bungalows',city='Kampong Som (Sihanoukville)',country='Cambodia',address='Otres Beach 2, Sangkat 4',description='Wooden bungalows a few steps from the sand on Otres Beach, with boat trips to Koh Rong arranged at reception.',timezone='Asia/Phnom_Penh',updated_at=now() WHERE id='10000000-0000-4000-8000-000000000003';

INSERT INTO hotel(id,name,slug,description,address,city,country,timezone,status) VALUES
('10000000-0000-4000-8000-000000000004','Sangker River House','sangker-river-house','A restored colonial-era shophouse beside the Sangker River, close to the bamboo train and Phare circus.','No. 7, Street 1.5, Svay Por','Battambang','Cambodia','Asia/Phnom_Penh','APPROVED'),
('10000000-0000-4000-8000-000000000005','Bokor View Guesthouse','bokor-view-guesthouse','Riverside rooms with views of Bokor Mountain. Bicycles and pepper-farm tours are available.','Riverside Road, Kampong Bay','Kampot','Cambodia','Asia/Phnom_Penh','APPROVED'),
('10000000-0000-4000-8000-000000000006','Crab Market Villas','crab-market-villas','Garden villas near the Kep crab market and the ferry to Rabbit Island.','Kep Beach Road, Prey Thom','Kep','Cambodia','Asia/Phnom_Penh','APPROVED'),
('10000000-0000-4000-8000-000000000007','Cardamom Gateway Lodge','cardamom-gateway-lodge','A riverside lodge for trips into the Cardamom Mountains, Tatai waterfall and the mangrove forest.','No. 3, Street 1, Smach Meanchey','Koh Kong','Cambodia','Asia/Phnom_Penh','APPROVED'),
('10000000-0000-4000-8000-000000000008','Sen Monorom Hillside Lodge','sen-monorom-hillside-lodge','Cool-climate cabins on the hills above Sen Monorom, close to Bou Sra waterfall.','Village 3, Spean Meanchey','Mondulkiri (Sen Monorom)','Cambodia','Asia/Phnom_Penh','APPROVED'),
('10000000-0000-4000-8000-000000000009','Dolphin Bend Homestay','dolphin-bend-homestay','A family-run homestay on the Mekong, a short ride from the Irrawaddy dolphin pools at Kampi.','Preah Sihanouk Street, Kratie','Kratie','Cambodia','Asia/Phnom_Penh','APPROVED');

UPDATE room_type SET name='Deluxe Garden King',description='King bed overlooking the garden courtyard.',capacity=2,base_price=58.00,currency='USD' WHERE id='20000000-0000-4000-8000-000000000001';
UPDATE room_type SET name='River View Studio',description='Studio with a balcony facing the river.',capacity=2,base_price=72.00,currency='USD' WHERE id='20000000-0000-4000-8000-000000000002';
UPDATE room_type SET name='Beach Bungalow',description='Bungalow with a hammock porch, steps from the beach.',capacity=3,base_price=65.00,currency='USD' WHERE id='20000000-0000-4000-8000-000000000003';

INSERT INTO room_type(id,hotel_id,name,description,capacity,base_price,currency) VALUES
('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Family Pool Suite','Two bedrooms opening onto the pool.',4,115.00,'USD'),
('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','Twin Room','Two single beds, ideal for temple-touring friends.',2,42.00,'USD'),
('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000002','Executive Suite','Separate living room with a river view.',3,135.00,'USD'),
('20000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000003','Sea View Double','Double room with a sea-view balcony.',2,48.00,'USD'),
('20000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000004','Heritage Double','High-ceilinged double in the original shophouse.',2,32.00,'USD'),
('20000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000004','Family Room','A double and two single beds.',4,55.00,'USD'),
('20000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000005','River Bungalow','Bungalow right on the Kampot river.',2,38.00,'USD'),
('20000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000005','Mountain View Suite','Suite facing Bokor Mountain.',3,70.00,'USD'),
('20000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000006','Garden Villa','Private villa set in a tropical garden.',2,85.00,'USD'),
('20000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000006','Family Villa','Two-bedroom villa with a kitchenette.',5,140.00,'USD'),
('20000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000007','Jungle Double','Double room with views over the forest.',2,40.00,'USD'),
('20000000-0000-4000-8000-000000000015','10000000-0000-4000-8000-000000000007','Riverside Twin','Twin room on the Koh Kong river.',2,36.00,'USD'),
('20000000-0000-4000-8000-000000000016','10000000-0000-4000-8000-000000000008','Hillside Bungalow','Wooden bungalow with a valley view.',2,34.00,'USD'),
('20000000-0000-4000-8000-000000000017','10000000-0000-4000-8000-000000000008','Family Cabin','Two-room cabin with a fireplace.',4,58.00,'USD'),
('20000000-0000-4000-8000-000000000018','10000000-0000-4000-8000-000000000009','Homestay Double','Simple double room in the family house.',2,22.00,'USD'),
('20000000-0000-4000-8000-000000000019','10000000-0000-4000-8000-000000000009','Mekong View Room','Upstairs room looking out over the Mekong.',3,35.00,'USD');

UPDATE room SET room_number='101' WHERE id='30000000-0000-4000-8000-000000000001';
UPDATE room SET room_number='301' WHERE id='30000000-0000-4000-8000-000000000002';
UPDATE room SET room_number='B1' WHERE id='30000000-0000-4000-8000-000000000003';

INSERT INTO room(id,hotel_id,room_type_id,room_number) VALUES
('30000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','102'),
('30000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','103'),
('30000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','201'),
('30000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','104'),
('30000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','105'),
('30000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','302'),
('30000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','303'),
('30000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000006','801'),
('30000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','B2'),
('30000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','B3'),
('30000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000007','201'),
('30000000-0000-4000-8000-000000000015','10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000007','202'),
('30000000-0000-4000-8000-000000000016','10000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000008','1'),
('30000000-0000-4000-8000-000000000017','10000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000008','2'),
('30000000-0000-4000-8000-000000000018','10000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000008','3'),
('30000000-0000-4000-8000-000000000019','10000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000009','4'),
('30000000-0000-4000-8000-000000000020','10000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000010','R1'),
('30000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000010','R2'),
('30000000-0000-4000-8000-000000000022','10000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000010','R3'),
('30000000-0000-4000-8000-000000000023','10000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000011','S1'),
('30000000-0000-4000-8000-000000000024','10000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000012','V1'),
('30000000-0000-4000-8000-000000000025','10000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000012','V2'),
('30000000-0000-4000-8000-000000000026','10000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000013','V3'),
('30000000-0000-4000-8000-000000000027','10000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000014','11'),
('30000000-0000-4000-8000-000000000028','10000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000014','12'),
('30000000-0000-4000-8000-000000000029','10000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000015','13'),
('30000000-0000-4000-8000-000000000030','10000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000015','14'),
('30000000-0000-4000-8000-000000000031','10000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000016','H1'),
('30000000-0000-4000-8000-000000000032','10000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000016','H2'),
('30000000-0000-4000-8000-000000000033','10000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000016','H3'),
('30000000-0000-4000-8000-000000000034','10000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000017','H4'),
('30000000-0000-4000-8000-000000000035','10000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000018','1'),
('30000000-0000-4000-8000-000000000036','10000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000018','2'),
('30000000-0000-4000-8000-000000000037','10000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000019','3');

UPDATE cancellation_policy SET name='Flexible',free_cancel_hours=48,refund_percent=50 WHERE hotel_id='10000000-0000-4000-8000-000000000001' AND active;
UPDATE cancellation_policy SET name='Flexible',free_cancel_hours=48,refund_percent=50 WHERE hotel_id='10000000-0000-4000-8000-000000000002' AND active;
UPDATE cancellation_policy SET name='Moderate',free_cancel_hours=72,refund_percent=25 WHERE hotel_id='10000000-0000-4000-8000-000000000003' AND active;
INSERT INTO cancellation_policy(hotel_id,name,free_cancel_hours,refund_percent,active) VALUES
('10000000-0000-4000-8000-000000000004','Flexible',24,50,true),
('10000000-0000-4000-8000-000000000005','Flexible',48,50,true),
('10000000-0000-4000-8000-000000000006','Moderate',72,25,true),
('10000000-0000-4000-8000-000000000007','Flexible',48,50,true),
('10000000-0000-4000-8000-000000000008','Non-refundable',0,0,true),
('10000000-0000-4000-8000-000000000009','Flexible',24,100,true);

-- Seasonal rates: dry high season (December to January) and Khmer New Year (mid-April).
INSERT INTO pricing_rule(room_type_id,starts_on,ends_on,nightly_price,currency,priority)
SELECT id,DATE '2026-12-01',DATE '2027-02-01',round(base_price*1.20,0),currency,1 FROM room_type WHERE id::text LIKE '20000000-0000-4000-8000-%'
UNION ALL
SELECT id,DATE '2027-04-13',DATE '2027-04-17',round(base_price*1.35,0),currency,10 FROM room_type WHERE id::text LIKE '20000000-0000-4000-8000-%';
