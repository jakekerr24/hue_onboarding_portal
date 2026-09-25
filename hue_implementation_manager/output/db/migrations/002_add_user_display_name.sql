-- The sidebar shows "Signed in as <name>"; without this, a real login would only have an email
-- to show. Nullable since not every future user necessarily needs one set immediately.
alter table users add column display_name text;
