-- Accounts, sign-in codes and sessions (docs/specs/accounts.md).
-- No IP addresses, device data or birth dates are stored.

-- Personal data (email, display name, bicycle types, confirmation dates).
-- Retention: until the rider deletes the account; the row is deleted immediately.
create table users (
	id uuid primary key,
	-- Normalised: trimmed and lower-case
	email varchar(254) not null unique,
	display_name varchar(40),
	-- Comma-separated, in the rider's order (the first is the route planner default)
	bicycle_types varchar(64) not null default '',
	age16_confirmed_at timestamptz not null,
	adult_confirmed_at timestamptz,
	terms_version varchar(32) not null,
	terms_accepted_at timestamptz not null,
	created_at timestamptz not null
);

-- One-time email codes, stored only as a keyed hash. One row per address and purpose:
-- a new code replaces the previous one.
-- Retention: deleted by the cleanup job once expired (10 minutes), and with the account.
create table email_codes (
	id uuid primary key,
	email varchar(254) not null,
	purpose varchar(20) not null,
	code_hash varchar(64) not null,
	expires_at timestamptz not null,
	attempts integer not null default 0,
	consumed boolean not null default false,
	created_at timestamptz not null,
	constraint email_codes_email_purpose_key unique (email, purpose),
	constraint email_codes_purpose_check check (purpose in ('SIGN_IN', 'DELETE_ACCOUNT'))
);

-- Sign-in sessions: created and last-used time only.
-- Retention: deleted by the cleanup job once revoked or unused for 60 days, and with the
-- account.
create table sessions (
	id uuid primary key,
	user_id uuid not null references users (id) on delete cascade,
	created_at timestamptz not null,
	last_used_at timestamptz not null,
	revoked_at timestamptz
);

create index sessions_user_id_idx on sessions (user_id);

-- Refresh tokens of a session, stored only as a SHA-256 hash. Used (rotated) tokens are
-- kept so that reusing one can revoke the whole session.
-- Retention: deleted with the session, and by the cleanup job after 60 days.
create table refresh_tokens (
	token_hash varchar(64) primary key,
	session_id uuid not null references sessions (id) on delete cascade,
	created_at timestamptz not null,
	used_at timestamptz
);

create index refresh_tokens_session_id_idx on refresh_tokens (session_id);
