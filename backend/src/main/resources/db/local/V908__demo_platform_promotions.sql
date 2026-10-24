-- Local/demo data only. One featured platform promotion running now, and a Khmer New Year offer scheduled ahead:
-- it is advertised automatically once its bookable window opens.
INSERT INTO promotion_code(hotel_id,code,headline,description,discount_type,discount_value,starts_on,ends_on,min_nights,one_per_guest,theme,featured)
VALUES
  (NULL,'GREEN10','Green season: 10% off every hotel','Lush rice fields, quiet temples and lower prices. Valid at every StayEase hotel for stays of 2 nights or more.',
   'PERCENT',10,NULL,current_date+45,2,true,'GREEN_SEASON',true),
  (NULL,'SOKSAN15','Khmer New Year: 15% off','Celebrate Choul Chnam Thmey with family. 15% off stays booked during the New Year week.',
   'PERCENT',15,make_date(extract(year FROM current_date)::int+1,4,8),make_date(extract(year FROM current_date)::int+1,4,17),1,true,'KHMER_NEW_YEAR',true)
ON CONFLICT DO NOTHING;
