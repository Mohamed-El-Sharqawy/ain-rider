-- ─── PostgreSQL init script ───────────────────────────────────────────────────
-- Runs once on first container start (docker-entrypoint-initdb.d).
-- Creates one database per service and enables required extensions.

-- Per-service databases (idempotent)
SELECT 'CREATE DATABASE ainrider_auth'   WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ainrider_auth')   \gexec
SELECT 'CREATE DATABASE ainrider_admin'  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ainrider_admin')  \gexec
SELECT 'CREATE DATABASE ainrider_trip'   WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ainrider_trip')   \gexec
SELECT 'CREATE DATABASE ainrider_payment' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ainrider_payment') \gexec
SELECT 'CREATE DATABASE ainrider_location' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ainrider_location') \gexec

-- Enable extensions in every database
\connect ainrider_auth
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\connect ainrider_admin
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\connect ainrider_trip
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\connect ainrider_payment
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Location DB needs TimescaleDB + PostGIS for time-series driver locations
\connect ainrider_location
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS driver_locations (
  id          BIGSERIAL,
  driver_id   VARCHAR(255)      NOT NULL,
  latitude    DOUBLE PRECISION  NOT NULL,
  longitude   DOUBLE PRECISION  NOT NULL,
  h3_index    VARCHAR(20)       NOT NULL,
  heading     DOUBLE PRECISION,
  speed       DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, recorded_at)
);

SELECT create_hypertable('driver_locations', 'recorded_at', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id
  ON driver_locations (driver_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_driver_locations_h3
  ON driver_locations (h3_index, recorded_at DESC);

SELECT add_retention_policy('driver_locations', INTERVAL '30 days', if_not_exists => TRUE);
