-- ══════════════════════════════════════════════
-- Unified Intelligence Platform — PostgreSQL Schema
-- ══════════════════════════════════════════════

-- ─── Users ──────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─── Documents ──────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
    id            SERIAL PRIMARY KEY,
    filename      VARCHAR(512) NOT NULL,
    original_name VARCHAR(512) NOT NULL,
    content_text  TEXT,
    status        VARCHAR(50) DEFAULT 'uploaded',
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_count  INTEGER DEFAULT 0,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at DESC);

-- ─── Activities ─────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
    id          SERIAL PRIMARY KEY,
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id   VARCHAR(255),
    details     TEXT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC);

-- ─── Settings ───────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    id      SERIAL PRIMARY KEY,
    key     VARCHAR(255) NOT NULL,
    value   TEXT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_settings_user_key ON settings(user_id, key);
