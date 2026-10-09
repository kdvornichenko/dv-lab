\set ON_ERROR_STOP on
SET client_min_messages = warning;

SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', 'dvlab_migrator', :'migrator_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dvlab_migrator')
\gexec

SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', 'dvlab_app', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dvlab_app')
\gexec

SELECT format('ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', 'dvlab_migrator', :'migrator_password') \gexec
SELECT format('ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', 'dvlab_app', :'app_password') \gexec

ALTER ROLE dvlab_migrator SET search_path = public, extensions;
ALTER ROLE dvlab_app SET search_path = public, extensions;

SELECT format('CREATE DATABASE %I OWNER %I ENCODING %L', :'db_name', 'dvlab_migrator', 'UTF8')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name')
\gexec

SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'db_name') \gexec
SELECT format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO %I', :'db_name', 'dvlab_app') \gexec

\connect :db_name

CREATE SCHEMA IF NOT EXISTS extensions AUTHORIZATION CURRENT_USER;
GRANT USAGE ON SCHEMA extensions TO dvlab_migrator, dvlab_app;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

GRANT USAGE ON SCHEMA public TO dvlab_app;

ALTER DEFAULT PRIVILEGES FOR ROLE dvlab_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dvlab_app;
ALTER DEFAULT PRIVILEGES FOR ROLE dvlab_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO dvlab_app;
