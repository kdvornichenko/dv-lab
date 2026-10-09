#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${DV_LAB_ROOT:-/opt/dv-lab}"
DIR="$ROOT/backups/db"
TMP_DB=dvlab_restorecheck

dc() {
	docker compose -f "$ROOT/repo/deploy/compose.yaml" --env-file "$ROOT/state/release.env" --env-file "$ROOT/env/db.env" "$@"
}

live() {
	dc exec -T db psql -X -U postgres -d dvlab -qAt -v ON_ERROR_STOP=1 -c "$1" < /dev/null
}

copy() {
	dc exec -T db psql -X -U postgres -d "$TMP_DB" -qAt -v ON_ERROR_STOP=1 -c "$1" < /dev/null
}

cleanup() {
	dc exec -T db psql -X -q -U postgres -d postgres -c "DROP DATABASE IF EXISTS $TMP_DB" > /dev/null 2>&1 < /dev/null || true
}
trap cleanup EXIT

DUMP=$(find "$DIR" -maxdepth 1 -name 'dvlab-daily-*.dump' | sort | tail -n 1)
test -s "$DUMP"
echo "restoring $DUMP"

dc exec -T db psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $TMP_DB" -c "CREATE DATABASE $TMP_DB OWNER dvlab_migrator" < /dev/null
dc exec -T db pg_restore -U postgres -d "$TMP_DB" --exit-on-error < "$DUMP"

QUERY='select count(*) from drizzle.__drizzle_migrations'
LIVE_MIGRATIONS=$(live "$QUERY")
COPY_MIGRATIONS=$(copy "$QUERY")
echo "migrations live=$LIVE_MIGRATIONS restored=$COPY_MIGRATIONS"
test "$COPY_MIGRATIONS" -ge 1
test "$COPY_MIGRATIONS" -le "$LIVE_MIGRATIONS"

TABLES=$(copy "select quote_ident(tablename) from pg_tables where schemaname = 'public' order by 1")
N=0
while read -r t; do
	if [ -z "$t" ]; then
		continue
	fi
	EXISTS=$(live "select to_regclass('public.$t') is not null")
	if [ "$EXISTS" != t ]; then
		echo "table $t is missing in the live database" >&2
		exit 1
	fi
	COPY_ROWS=$(copy "select count(*) from public.$t")
	LIVE_ROWS=$(live "select count(*) from public.$t")
	if [ "$COPY_ROWS" -gt "$LIVE_ROWS" ]; then
		echo "table $t: restored=$COPY_ROWS is more than live=$LIVE_ROWS" >&2
		exit 1
	fi
	N=$((N + 1))
done <<< "$TABLES"
echo "tables=$N"
echo "RESTORE_OK"
