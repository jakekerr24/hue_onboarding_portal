-- Clients renew year over year (or churn), but this system is the record of their implementation
-- history -- signed contracts, plan documents, deliverable timelines -- so a churned client is
-- marked inactive (hidden from the default list/search) rather than deleted. Hard delete stays
-- available separately, reserved for genuine test/junk entries, not real former clients.
alter table clients add column status text not null default 'active' check (status in ('active', 'inactive'));
