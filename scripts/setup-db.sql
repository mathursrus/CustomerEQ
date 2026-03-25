-- Run this once after PostgreSQL is installed:
-- psql -U postgres -f scripts/setup-db.sql

CREATE USER customereq WITH PASSWORD 'customereq';
CREATE DATABASE customereq OWNER customereq;
GRANT ALL PRIVILEGES ON DATABASE customereq TO customereq;
