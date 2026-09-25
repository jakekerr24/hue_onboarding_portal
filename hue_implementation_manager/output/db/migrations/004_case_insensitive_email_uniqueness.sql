-- Login is now case-insensitive on email (auth.js), so uniqueness must be too, or two accounts
-- differing only in case (e.g. "Jordan@x.com" and "jordan@x.com") could both be created and one
-- would shadow the other at login. The plain `email unique` constraint from 001_init.sql doesn't
-- catch that; this adds a case-insensitive one on top without removing the original.
create unique index users_email_lower_idx on users (lower(email));
