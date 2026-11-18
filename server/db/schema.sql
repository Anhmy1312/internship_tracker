CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company TEXT NOT NULL CHECK (length(company) BETWEEN 1 AND 200),
    role TEXT NOT NULL CHECK (length(role) BETWEEN 1 AND 200),
    jd_url TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    remote BOOLEAN NOT NULL DEFAULT false,
    deadline DATE,
    status TEXT NOT NULL DEFAULT 'wishlist'
        CHECK( status IN ('wishlist','applied','interview','offer', 'rejected')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS applications_user_deadline_idx ON applications(user_id, deadline);

CREATE INDEX IF NOT EXISTS applications_user_status_idx ON applications(user_id, status);

CREATE INDEX IF NOT EXISTS applications_user_created_idx ON applications(user_id, created_at);



