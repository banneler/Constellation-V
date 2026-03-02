-- Demo data for Constellation CRM – Great Plains Communications (gpcom.com) sales context
-- Run in Supabase SQL Editor (or psql). All data uses user_id below.
-- IDs use bigint (900001+) so they don't clash with real data. user_id remains UUID for auth.
-- Ensure user 15c791de-5f29-418d-b17f-0feabd9c953e exists in auth.users if RLS filters by auth.uid().

BEGIN;

-- ========== ACCOUNTS (id bigint) ==========
INSERT INTO accounts (id, name, user_id, website, industry, phone, address, notes, is_customer, quantity_of_sites, employee_count) OVERRIDING SYSTEM VALUE VALUES
  (900001, 'Midwest Manufacturing Co', '15c791de-5f29-418d-b17f-0feabd9c953e', 'https://midwestmfg.example.com', 'Manufacturing', '402-555-1001', '123 Industrial Pkwy, Lincoln, NE', 'Multi-site fiber candidate.', true, 3, 120),
  (900002, 'Lincoln School District', '15c791de-5f29-418d-b17f-0feabd9c953e', 'https://lincolnschools.org', 'Education', '402-555-2002', '500 S 50th St, Lincoln, NE', 'E-rate eligible.', false, 12, 800),
  (900003, 'Regional Hospital System', '15c791de-5f29-418d-b17f-0feabd9c953e', 'https://regionalhealth.org', 'Healthcare', '402-555-3003', '1600 S 48th St, Lincoln, NE', 'Needs redundant fiber + VoIP.', false, 5, 2000),
  (900004, 'Carrier Partners LLC', '15c791de-5f29-418d-b17f-0feabd9c953e', 'https://carrierpartners.io', 'Telecommunications', '317-555-4004', 'Indianapolis, IN', 'Wholesale / backhaul interest.', false, 1, 45),
  (900005, 'Front Range Business Park', '15c791de-5f29-418d-b17f-0feabd9c953e', NULL, 'Real Estate', '303-555-5005', 'Denver, CO', 'Fiber to the building for tenants.', false, 8, 15)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, website = EXCLUDED.website, industry = EXCLUDED.industry,
  phone = EXCLUDED.phone, address = EXCLUDED.address, notes = EXCLUDED.notes,
  is_customer = EXCLUDED.is_customer, quantity_of_sites = EXCLUDED.quantity_of_sites, employee_count = EXCLUDED.employee_count;

-- ========== CONTACTS (id bigint, account_id bigint) ==========
INSERT INTO contacts (id, first_name, last_name, email, phone, title, account_id, user_id) OVERRIDING SYSTEM VALUE VALUES
  (900001, 'Sarah', 'Chen', 'sarah.chen@midwestmfg.example.com', '402-555-1011', 'IT Director', 900001, '15c791de-5f29-418d-b17f-0feabd9c953e'),
  (900002, 'Mike', 'Torres', 'mtorres@midwestmfg.example.com', '402-555-1012', 'CFO', 900001, '15c791de-5f29-418d-b17f-0feabd9c953e'),
  (900003, 'Jennifer', 'Walsh', 'jwalsh@lincolnschools.org', '402-555-2011', 'Director of Technology', 900002, '15c791de-5f29-418d-b17f-0feabd9c953e'),
  (900004, 'David', 'Kim', 'dkim@regionalhealth.org', '402-555-3011', 'VP Infrastructure', 900003, '15c791de-5f29-418d-b17f-0feabd9c953e'),
  (900005, 'Lisa', 'Nguyen', 'lisa@carrierpartners.io', '317-555-4011', 'Network Operations', 900004, '15c791de-5f29-418d-b17f-0feabd9c953e'),
  (900006, 'Tom', 'Anderson', 'tanderson@frontrange.example.com', '303-555-5011', 'Property Manager', 900005, '15c791de-5f29-418d-b17f-0feabd9c953e')
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, email = EXCLUDED.email,
  phone = EXCLUDED.phone, title = EXCLUDED.title, account_id = EXCLUDED.account_id;

-- ========== DEALS (id bigint, account_id bigint) ==========
-- Use stage_name values that exist in your deal_stages table.
INSERT INTO deals (id, name, account_id, user_id, stage, term, mrc, close_month, products, notes, is_committed) OVERRIDING SYSTEM VALUE VALUES
  (900001, 'Midwest Mfg – Fiber upgrade 3 sites', 900001, '15c791de-5f29-418d-b17f-0feabd9c953e', 'Proposal', '36', 2400, '2025-03', 'Fiber Internet, VoIP', 'Ethernet + cloud voice.', true),
  (900002, 'Lincoln Schools – E-rate fiber', 900002, '15c791de-5f29-418d-b17f-0feabd9c953e', 'Discovery', '60', 5200, '2025-06', 'Fiber Internet', '12 sites.', false),
  (900003, 'Regional Health – redundant fiber + VoIP', 900003, '15c791de-5f29-418d-b17f-0feabd9c953e', 'Qualification', '24', 3800, '2025-04', 'Fiber Internet, Cloud Voice', NULL, false),
  (900004, 'Carrier Partners – backhaul', 900004, '15c791de-5f29-418d-b17f-0feabd9c953e', 'Negotiation', '48', 12000, '2025-02', 'Carrier & Wholesale', 'Point-to-point.', true),
  (900005, 'Front Range – fiber to building', 900005, '15c791de-5f29-418d-b17f-0feabd9c953e', 'Closed Won', '36', 1800, '2025-01', 'Fiber Internet', 'Won Jan 2025.', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, account_id = EXCLUDED.account_id, stage = EXCLUDED.stage, term = EXCLUDED.term,
  mrc = EXCLUDED.mrc, close_month = EXCLUDED.close_month, products = EXCLUDED.products, notes = EXCLUDED.notes, is_committed = EXCLUDED.is_committed;

-- ========== TASKS (id uuid, default gen_random_uuid(); do not supply id) ==========
INSERT INTO tasks (description, due_date, status, account_id, contact_id, user_id) VALUES
  ('Send proposal to Sarah Chen – Midwest Mfg', (CURRENT_DATE + 3)::timestamptz, 'Pending', 900001, 900001, '15c791de-5f29-418d-b17f-0feabd9c953e'),
  ('Schedule site survey – Lincoln Schools', (CURRENT_DATE + 7)::timestamptz, 'Pending', 900002, 900003, '15c791de-5f29-418d-b17f-0feabd9c953e'),
  ('Follow up with David Kim – Regional Health', (CURRENT_DATE + 1)::timestamptz, 'Pending', 900003, 900004, '15c791de-5f29-418d-b17f-0feabd9c953e'),
  ('Contract review – Carrier Partners', (CURRENT_DATE + 5)::timestamptz, 'Pending', 900004, NULL, '15c791de-5f29-418d-b17f-0feabd9c953e'),
  ('Kickoff call – Front Range', (CURRENT_DATE - 2)::timestamptz, 'Completed', 900005, 900006, '15c791de-5f29-418d-b17f-0feabd9c953e');

-- ========== ACTIVITIES (id bigint, account_id/contact_id bigint) ==========
INSERT INTO activities (id, contact_id, account_id, type, description, date, user_id, logged_to_sf) OVERRIDING SYSTEM VALUE VALUES
  (900001, 900001, 900001, 'Call', 'Discovery call – fiber needs at 3 sites.', (CURRENT_DATE - 14)::timestamptz, '15c791de-5f29-418d-b17f-0feabd9c953e', false),
  (900002, 900001, 900001, 'Email', 'Sent pricing – Business Fiber + VoIP bundle.', (CURRENT_DATE - 10)::timestamptz, '15c791de-5f29-418d-b17f-0feabd9c953e', false),
  (900003, 900002, 900001, 'Call', 'CFO review – budget approval path.', (CURRENT_DATE - 5)::timestamptz, '15c791de-5f29-418d-b17f-0feabd9c953e', false),
  (900004, 900003, 900002, 'Call', 'E-rate timeline and 471 discussion.', (CURRENT_DATE - 7)::timestamptz, '15c791de-5f29-418d-b17f-0feabd9c953e', false),
  (900005, 900004, 900003, 'Meeting', 'On-site – redundancy and SIP requirements.', (CURRENT_DATE - 3)::timestamptz, '15c791de-5f29-418d-b17f-0feabd9c953e', false),
  (900006, 900005, 900004, 'Call', 'Technical review – backhaul capacity.', (CURRENT_DATE - 1)::timestamptz, '15c791de-5f29-418d-b17f-0feabd9c953e', false),
  (900007, 900006, 900005, 'Email', 'Contract signed – fiber to building.', (CURRENT_DATE - 30)::timestamptz, '15c791de-5f29-418d-b17f-0feabd9c953e', true)
ON CONFLICT (id) DO UPDATE SET
  contact_id = EXCLUDED.contact_id, account_id = EXCLUDED.account_id, type = EXCLUDED.type,
  description = EXCLUDED.description, date = EXCLUDED.date, logged_to_sf = EXCLUDED.logged_to_sf;

-- ========== SEQUENCES (id bigint) ==========
INSERT INTO sequences (id, name, source, user_id, is_abm) OVERRIDING SYSTEM VALUE VALUES
  (900001, 'GPCom Business Fiber – 5 step', 'Personal', '15c791de-5f29-418d-b17f-0feabd9c953e', false),
  (900002, 'Carrier / Wholesale intro', 'Personal', '15c791de-5f29-418d-b17f-0feabd9c953e', false)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, source = EXCLUDED.source;

-- ========== SEQUENCE STEPS (id bigint, sequence_id bigint) ==========
INSERT INTO sequence_steps (id, sequence_id, step_number, type, subject, message, delay_days, user_id) OVERRIDING SYSTEM VALUE VALUES
  (900001, 900001, 1, 'Email', 'Great Plains Fiber – quick intro', 'Hi {{first_name}}, we provide business fiber across NE/IN/CO. Would a 15-min call work?', 0, '15c791de-5f29-418d-b17f-0feabd9c953e'),
  (900002, 900001, 2, 'Call', NULL, 'Discovery call', 3, '15c791de-5f29-418d-b17f-0feabd9c953e'),
  (900003, 900001, 3, 'Email', 'Follow-up – proposal', 'Attached proposal for fiber + VoIP.', 5, '15c791de-5f29-418d-b17f-0feabd9c953e'),
  (900004, 900001, 4, 'Call', NULL, 'Proposal review', 4, '15c791de-5f29-418d-b17f-0feabd9c953e'),
  (900005, 900002, 1, 'Email', 'Carrier / wholesale inquiry', 'We have fiber across the region. Interested in backhaul or diversity?', 0, '15c791de-5f29-418d-b17f-0feabd9c953e'),
  (900006, 900002, 2, 'Call', NULL, 'Capacity and pricing', 5, '15c791de-5f29-418d-b17f-0feabd9c953e')
ON CONFLICT (id) DO UPDATE SET
  sequence_id = EXCLUDED.sequence_id, step_number = EXCLUDED.step_number, type = EXCLUDED.type,
  subject = EXCLUDED.subject, message = EXCLUDED.message, delay_days = EXCLUDED.delay_days;

-- ========== CONTACT SEQUENCES (id bigint, contact_id/sequence_id bigint) ==========
INSERT INTO contact_sequences (id, contact_id, sequence_id, status, current_step_number, next_step_due_date, user_id) OVERRIDING SYSTEM VALUE VALUES
  (900001, 900003, 900001, 'Active', 1, (CURRENT_DATE + 2)::timestamptz, '15c791de-5f29-418d-b17f-0feabd9c953e'),
  (900002, 900005, 900002, 'Active', 2, (CURRENT_DATE + 1)::timestamptz, '15c791de-5f29-418d-b17f-0feabd9c953e'),
  (900003, 900006, 900001, 'Completed', 5, (CURRENT_DATE - 5)::timestamptz, '15c791de-5f29-418d-b17f-0feabd9c953e')
ON CONFLICT (id) DO UPDATE SET
  contact_id = EXCLUDED.contact_id, sequence_id = EXCLUDED.sequence_id, status = EXCLUDED.status,
  current_step_number = EXCLUDED.current_step_number, next_step_due_date = EXCLUDED.next_step_due_date;

-- ========== CAMPAIGNS (id bigint, GENERATED BY DEFAULT – no OVERRIDING needed) ==========
INSERT INTO campaigns (id, name, type, filter_criteria, email_subject, email_body, user_id, created_at, completed_at) VALUES
  (900001, 'Q1 Fiber Outreach – Nebraska', 'Call', '{"industry": null, "status": null, "starred_only": false}'::jsonb, NULL, NULL, '15c791de-5f29-418d-b17f-0feabd9c953e', (CURRENT_DATE - 20)::timestamptz, NULL),
  (900002, 'Business VoIP – Jan blitz', 'Guided Email', '{"industry": "Healthcare", "status": null, "starred_only": false}'::jsonb, 'Great Plains Cloud Voice for Healthcare', 'Hi {{first_name}}, we offer reliable cloud voice and fiber. Can we schedule a brief call?', '15c791de-5f29-418d-b17f-0feabd9c953e', (CURRENT_DATE - 45)::timestamptz, (CURRENT_DATE - 30)::timestamptz)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, completed_at = EXCLUDED.completed_at;

-- ========== CAMPAIGN MEMBERS (id bigint, GENERATED BY DEFAULT) ==========
INSERT INTO campaign_members (id, campaign_id, contact_id, user_id, status, notes, completed_at) VALUES
  (900001, 900001, 900001, '15c791de-5f29-418d-b17f-0feabd9c953e', 'Completed', 'Left VM.', (CURRENT_DATE - 18)::timestamptz),
  (900002, 900001, 900003, '15c791de-5f29-418d-b17f-0feabd9c953e', 'Pending', NULL, NULL),
  (900003, 900001, 900004, '15c791de-5f29-418d-b17f-0feabd9c953e', 'Skipped', NULL, (CURRENT_DATE - 17)::timestamptz),
  (900004, 900002, 900004, '15c791de-5f29-418d-b17f-0feabd9c953e', 'Completed', 'Email opened.', (CURRENT_DATE - 32)::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  campaign_id = EXCLUDED.campaign_id, contact_id = EXCLUDED.contact_id, status = EXCLUDED.status,
  notes = EXCLUDED.notes, completed_at = EXCLUDED.completed_at;

COMMIT;

-- Note: If your deal_stages table uses different stage_name values, update the deals INSERT to match (e.g. Discovery, Qualification, Proposal, Negotiation, Closed Won, Closed Lost).
