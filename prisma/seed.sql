INSERT INTO "Alerts" (raw_text, source, incident_type, coordinates, urgency_score, financial_target_usd, financial_raised_usd, source_credibility_score, verified_status, timestamp)
VALUES
  ('Medical evacuation requested near Maiduguri Market after armed attack. North access road blocked.', 'GDACS', 'Terrorism_Attack', ST_SetSRID(ST_MakePoint(13.18, 11.84), 4326), 5, 180000, 22000, 0.85, true, NOW() - INTERVAL '2 minutes'),
  ('Flooding across low-lying Benue communities. School shelter opened but water purification needed.', 'Social Media', 'Natural_Disaster', ST_SetSRID(ST_MakePoint(8.75, 7.33), 4326), 4, 95000, 31000, 0.72, true, NOW() - INTERVAL '9 minutes'),
  ('Clinic network in Kano requests emergency medicine restock for displaced families.', 'Partner Feed', 'Natural_Disaster', ST_SetSRID(ST_MakePoint(8.52, 12.0), 4326), 3, 70000, 46000, 0.91, true, NOW() - INTERVAL '16 minutes'),
  ('Fire reported at IDP camp near Abuja. Multiple shelters destroyed.', 'SMS Alert', 'Natural_Disaster', ST_SetSRID(ST_MakePoint(7.49, 9.08), 4326), 5, 220000, 5000, 0.68, true, NOW() - INTERVAL '30 minutes'),
  ('Landslide blocking main supply route to Jos. Humanitarian convoy delayed.', 'Telegram', 'Natural_Disaster', ST_SetSRID(ST_MakePoint(8.89, 9.93), 4326), 4, 85000, 12000, 0.79, true, NOW() - INTERVAL '45 minutes'),
  ('Armed group ambush reported near Damaturu. WFP logistics team taking cover.', 'Partner Feed', 'Terrorism_Attack', ST_SetSRID(ST_MakePoint(11.96, 11.75), 4326), 5, 250000, 15000, 0.88, true, NOW() - INTERVAL '1 hour'),
  ('Cholera outbreak confirmed in Makurdi. Three treatment centers need supplies.', 'WHO Alert', 'Natural_Disaster', ST_SetSRID(ST_MakePoint(8.53, 7.73), 4326), 4, 120000, 45000, 0.95, true, NOW() - INTERVAL '1 hour 30 minutes'),
  ('Severe storm warning for Lagos coastal areas. Emergency shelters activated.', 'GDACS', 'Natural_Disaster', ST_SetSRID(ST_MakePoint(3.38, 6.52), 4326), 3, 60000, 8000, 0.82, true, NOW() - INTERVAL '2 hours'),
  ('Kidnapping reported on highway near Kaduna. Search operation underway.', 'SMS Alert', 'Terrorism_Attack', ST_SetSRID(ST_MakePoint(7.44, 10.52), 4326), 5, 195000, 0, 0.61, true, NOW() - INTERVAL '2 hours 15 minutes'),
  ('Food distribution center in Yola running low on supplies. 5000+ displaced.', 'NGO Report', 'Natural_Disaster', ST_SetSRID(ST_MakePoint(12.48, 9.23), 4326), 3, 55000, 33000, 0.90, true, NOW() - INTERVAL '3 hours'),
  ('Typhoon surge flooding coastal Bicol. School shelters opened, families trapped on rooftops.', 'GDACS', 'Natural_Disaster', ST_SetSRID(ST_MakePoint(123.4, 13.5), 4326), 5, 200000, 40000, 0.88, true, NOW() - INTERVAL '1 hour'),
  ('Landslide on Mindoro mountain road after torrential rain. Aid convoy stranded.', 'Social Media', 'Natural_Disaster', ST_SetSRID(ST_MakePoint(121.0, 12.9), 4326), 4, 90000, 15000, 0.74, true, NOW() - INTERVAL '2 hours'),
  ('Earthquake aftershocks near Cauayan. Structural damage reported, need shelter kits.', 'WHO Alert', 'Natural_Disaster', ST_SetSRID(ST_MakePoint(121.77, 17.12), 4326), 4, 130000, 25000, 0.92, true, NOW() - INTERVAL '4 hours'),
  ('Severe flooding in Jakarta low-lying districts. Thousands displaced, water rescues ongoing.', 'Social Media', 'Natural_Disaster', ST_SetSRID(ST_MakePoint(106.85, -6.21), 4326), 5, 260000, 60000, 0.81, true, NOW() - INTERVAL '3 hours'),
  ('Wildfire approaching residential area north of Athens. Evacuation underway, hospitals at risk.', 'GDACS', 'Natural_Disaster', ST_SetSRID(ST_MakePoint(23.73, 38.08), 4326), 5, 240000, 30000, 0.86, true, NOW() - INTERVAL '5 hours'),
  ('Flash flood in central Bosnia villages. Bridges washed out, supplies cut off.', 'Telegram', 'Natural_Disaster', ST_SetSRID(ST_MakePoint(18.1, 44.0), 4326), 4, 100000, 18000, 0.78, true, NOW() - INTERVAL '6 hours'),
  ('Armed unrest in Mogadishu district. MSF clinic staff requesting security corridor.', 'Partner Feed', 'Terrorism_Attack', ST_SetSRID(ST_MakePoint(45.3, 2.05), 4326), 5, 210000, 14000, 0.75, true, NOW() - INTERVAL '3 hours'),
  ('Hurricane damage on Caribbean island. Entire village without power or clean water.', 'GDACS', 'Natural_Disaster', ST_SetSRID(ST_MakePoint(-61.0, 10.6), 4326), 5, 280000, 50000, 0.9, true, NOW() - INTERVAL '7 hours');

INSERT INTO "NGO_Users" (organization_name, sector, payout_url, active_region)
VALUES
  ('Doctors Without Borders', 'Medical', 'https://payments.example.org/msf', 'Global'),
  ('Red Cross Nigeria', 'Medical', 'https://payments.example.org/redcross', 'West Africa'),
  ('World Food Programme', 'Food', 'https://payments.example.org/wfp', 'Global'),
  ('UNICEF Philippines', 'Water', 'https://payments.example.org/unicef', 'Asia-Pacific'),
  ('International Rescue Committee', 'Shelter', 'https://payments.example.org/irc', 'Conflict Zones'),
  ('Save the Children', 'Medical', 'https://payments.example.org/savethechildren', 'Global'),
  ('Oxfam Indonesia', 'Water', 'https://payments.example.org/oxfam', 'Indian Ocean'),
  ('CARE International', 'Food', 'https://payments.example.org/care', 'Global');
