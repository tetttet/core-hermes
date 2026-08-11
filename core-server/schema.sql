BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL,
  password_hash varchar(255) NOT NULL,
  first_name varchar(80) NOT NULL,
  last_name varchar(80) NOT NULL,
  age smallint NOT NULL CHECK (age BETWEEN 13 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_lowercase CHECK (email = lower(email)),
  CONSTRAINT users_email_key UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS user_survey (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_key varchar(64) NOT NULL,
  answer varchar(500) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_key)
);

CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(160) NOT NULL,
  model_id varchar(120) NOT NULL,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role varchar(9) NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL DEFAULT '',
  model_id varchar(120),
  has_attachment boolean NOT NULL DEFAULT false,
  attachment_meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_attachment_meta_consistent CHECK (
    (has_attachment AND attachment_meta IS NOT NULL)
    OR (NOT has_attachment AND attachment_meta IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS rate_limits (
  guest_id varchar(66) PRIMARY KEY,
  request_count smallint NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  week_start date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  replaced_by uuid REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash)
);

-- These covering sort keys back cursor pagination without an extra sort.
CREATE INDEX IF NOT EXISTS messages_chat_created_idx
  ON messages (chat_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS chats_user_updated_idx
  ON chats (user_id, updated_at DESC, id DESC);
-- user_survey(user_id) is already the leading edge of its primary-key index.
CREATE INDEX IF NOT EXISTS refresh_tokens_user_active_idx
  ON refresh_tokens (user_id, expires_at DESC)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS refresh_tokens_expiry_idx
  ON refresh_tokens (expires_at);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chats_set_updated_at ON chats;
CREATE TRIGGER chats_set_updated_at
BEFORE UPDATE ON chats
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION touch_chat_from_message()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE chats SET updated_at = now() WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_touch_chat ON messages;
CREATE TRIGGER messages_touch_chat
AFTER INSERT OR UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION touch_chat_from_message();

COMMIT;
