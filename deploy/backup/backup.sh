#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${DV_LAB_ROOT:-/opt/dv-lab}"
DIR="$ROOT/backups/db"
STAMP=$(date -u +%Y%m%d-%H%M%S)
OUT="$DIR/dvlab-daily-$STAMP.dump"
PART="$OUT.part"

dc() {
	docker compose -f "$ROOT/repo/deploy/compose.yaml" --env-file "$ROOT/state/release.env" --env-file "$ROOT/env/db.env" "$@"
}

cleanup() {
	rm -f "$PART"
}
trap cleanup ERR EXIT

prune() {
	find "$DIR" -maxdepth 1 -name "$1-*.dump" | sort -r | tail -n "+$(( $2 + 1 ))" | while read -r f; do
		rm -f -- "$f"
	done
}

mkdir -p "$DIR"

dc exec -T db pg_dump -U postgres -d dvlab -Fc > "$PART"
dc exec -T db pg_restore --list < "$PART" > /dev/null
mv "$PART" "$OUT"

RECENT_WEEKLY=$(find "$DIR" -maxdepth 1 -name 'dvlab-weekly-*.dump' -mtime -7)
if [ -z "$RECENT_WEEKLY" ]; then
	ln "$OUT" "$DIR/dvlab-weekly-$STAMP.dump"
fi

prune dvlab-daily 14
prune dvlab-weekly 8

echo "BACKUP_OK $OUT"
