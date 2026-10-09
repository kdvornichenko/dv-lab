#!/usr/bin/env bash
set -Eeuo pipefail

psql -X -q -v ON_ERROR_STOP=1 \
	-U "${POSTGRES_USER:-postgres}" \
	-d postgres \
	-v db_name="${APP_DB_NAME:-dvlab}" \
	-v migrator_password="${MIGRATOR_PASSWORD:?}" \
	-v app_password="${APP_PASSWORD:?}" \
	-f /deploy/postgres/ensure-db.sql
