alter table qib.memberships add column if not exists primary_specialty_id uuid references qib.specialties(id);
insert into qib.specialties(code,label) values
  ('derm_laser','Laser'),
  ('derm_skin_care','Skin Care'),
  ('derm_assistance','Dermatology Clinical Assistance')
on conflict(code) do nothing;
