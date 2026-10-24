INSERT INTO hotel(id,name,slug,description,address,city,country,timezone,status) VALUES
('10000000-0000-4000-8000-000000000001','The Willow House','willow-house','A quiet garden stay close to the old town.','12 Garden Lane','Chiang Mai','Thailand','Asia/Bangkok','APPROVED'),
('10000000-0000-4000-8000-000000000002','Serein Riverside','serein-riverside','A relaxed riverside base for a city visit.','88 River Road','Bangkok','Thailand','Asia/Bangkok','APPROVED'),
('10000000-0000-4000-8000-000000000003','Coast & Canopy','coast-canopy','A small coastal retreat with shaded courtyards.','5 Shore Walk','Phuket','Thailand','Asia/Bangkok','APPROVED');

INSERT INTO room_type(id,hotel_id,name,description,capacity,base_price,currency) VALUES
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Garden King','King bed with a garden view.',2,2450.00,'THB'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','River Studio','Studio with a view of the river.',2,3100.00,'THB'),
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','Canopy Suite','Suite near the beach and garden.',3,4200.00,'THB');

INSERT INTO room(id,hotel_id,room_type_id,room_number) VALUES
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','G01'),
('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','R01'),
('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','C01');

INSERT INTO cancellation_policy(hotel_id,name,free_cancel_hours,refund_percent,active) VALUES
('10000000-0000-4000-8000-000000000001','Flexible',48,100,true),
('10000000-0000-4000-8000-000000000002','Flexible',48,100,true),
('10000000-0000-4000-8000-000000000003','Flexible',48,100,true);
