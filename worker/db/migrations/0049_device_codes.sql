-- Device Authorization Grant (RFC 8628)
--
-- Enables CLI/IoT/limited-input clients to authenticate by having the user
-- enter a short code on a browser-equipped device.
--
-- Flow:
--  1. Client POSTs /api/oauth/device/code with client_id + scope.
--  2. Server returns device_code (opaque, for polling/SSE) and user_code
--     (short human-readable string the user types into the browser).
--  3. User navigates to /oauth/device, enters user_code, sees the consent
--     screen, and approves or denies.
--  4. Client learns of approval via polling (POST /api/oauth/token with
--     grant_type=urn:ietf:params:oauth:grant-type:device_code) or via SSE
--     (GET /api/oauth/device/sse?device_code=...).
--  5. On approval the token endpoint issues access/refresh tokens normally.

CREATE TABLE device_codes (
  id          TEXT PRIMARY KEY,
  device_code TEXT NOT NULL UNIQUE,
  user_code   TEXT NOT NULL UNIQUE,
  client_id   TEXT NOT NULL,
  scope       TEXT NOT NULL DEFAULT '[]',   -- JSON string[]
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | authorized | denied | expired
  user_id     TEXT,                          -- set when user authorizes
  code_challenge        TEXT,
  code_challenge_method TEXT,
  interval    INTEGER NOT NULL DEFAULT 5,   -- polling interval in seconds
  last_polled_at INTEGER,                   -- rate-limit slow_down detection
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE INDEX idx_device_codes_user_code ON device_codes(user_code);
CREATE INDEX idx_device_codes_device_code ON device_codes(device_code);
CREATE INDEX idx_device_codes_expires ON device_codes(expires_at);
