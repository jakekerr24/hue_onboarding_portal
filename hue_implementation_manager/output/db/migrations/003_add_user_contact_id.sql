-- Links a client-role login to the contact record it belongs to, so a login is always tied to a
-- real person already tracked in the contacts pool rather than a freestanding account with its
-- own separate name. Nullable (manager logins aren't tied to a contact) and unique (one login per
-- contact -- individual logins per person, not a shared credential; Postgres allows multiple NULLs
-- under a plain unique constraint, so this doesn't block manager rows).
alter table users add column contact_id uuid references contacts(id);
alter table users add constraint users_contact_id_unique unique (contact_id);
