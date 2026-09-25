-- Initial schema for the 39N Health implementation portal.
--
-- Key design decisions (see chat for the fuller discussion):
-- * template_deliverables / template_expectations hold the single global template.
-- * client_deliverables / client_expectations are full, independent COPIES made when a client
--   is created (or reset to standard) -- never a live join to the template. source_template_item_id
--   is kept only for lineage/reporting; the displayed content always comes from the copy itself,
--   so editing the template never changes an existing client, and editing one client's items
--   never touches the template or any other client.
-- * contacts is a reusable global library (internal staff / partner reps / broker reps / employer
--   contacts all in one table); client_contacts is just the attachment, so removing a contact from
--   a client never deletes the underlying record.
-- * brokers is reusable the same way (the same brokerage often represents many clients), but
--   vendor-integration/COBRA details and broker notes are specific to one client's relationship
--   with that broker, so they live on clients, not on brokers.

create extension if not exists pgcrypto;

create table contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text,
  phone text,
  email text,
  role text,
  category text not null check (category in ('internal', 'partner', 'broker', 'employer')),
  org text,
  partner_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table brokers (
  id uuid primary key default gen_random_uuid(),
  broker_name text,
  firm_name text not null,
  firm_address text,
  firm_tax_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  plan_sponsor_name text not null,
  address text not null,
  tax_id text,
  sic_code text,
  org_type text,
  company_size text,
  locations text,
  effective_date date not null,
  waiting_period text,
  excluded_classes text[] not null default '{}',
  hp_network text,
  national_network text,
  notes text,
  broker_id uuid references brokers(id),
  broker_notes text,
  vendor_integration_required boolean not null default false,
  vendor_integration_platform text,
  cobra_vendor_name text,
  cobra_vendor_contact text,
  cobra_vendor_phone text,
  cobra_vendor_email text,
  template_applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table client_contacts (
  client_id uuid not null references clients(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  signatory boolean not null default false,
  added_at timestamptz not null default now(),
  primary key (client_id, contact_id)
);

create table template_deliverables (
  id uuid primary key default gen_random_uuid(),
  phase text not null check (phase in ('pre', 'post')),
  sort_order integer not null,
  name text not null,
  due_date_rule text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table template_expectations (
  id uuid primary key default gen_random_uuid(),
  group_title text not null,
  audience text not null,
  sort_order integer not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table client_deliverables (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  source_template_item_id uuid references template_deliverables(id) on delete set null,
  phase text not null check (phase in ('pre', 'post')),
  sort_order integer not null,
  name text not null,
  due_date_rule text not null,
  note text,
  is_complete boolean not null default false,
  completed_at timestamptz,
  completed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table client_expectations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  source_template_item_id uuid references template_expectations(id) on delete set null,
  group_title text not null,
  audience text not null,
  sort_order integer not null,
  title text not null,
  body text not null,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  description text,
  category text not null check (category in ('plan-documents', 'resources-education', 'contracts-agreements')),
  signature_status text not null default 'none' check (signature_status in ('none', 'needs-signature', 'signed')),
  file_type text,
  file_size_bytes bigint,
  storage_path text, -- local path for now; becomes an S3 key once Phase D adds real file storage
  owner text,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  role text not null check (role in ('manager', 'client')),
  client_id uuid references clients(id), -- set only when role = 'client'
  created_at timestamptz not null default now()
);

create index client_contacts_contact_id_idx on client_contacts (contact_id);
create index client_deliverables_client_id_idx on client_deliverables (client_id);
create index client_expectations_client_id_idx on client_expectations (client_id);
create index client_documents_client_id_idx on client_documents (client_id);
create index clients_broker_id_idx on clients (broker_id);
