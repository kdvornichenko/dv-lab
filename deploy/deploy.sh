#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${DV_LAB_ROOT:-/opt/dv-lab}"
REPO="$ROOT/repo"
STATE="$ROOT/state"
DUMPS="$ROOT/backups/db"
JOURNAL="$STATE/deploy-journal.log"
IMAGES=ghcr.io/kdvornichenko/dv-lab
SITE=https://dv-lab.dev
REF="${1:-origin/master}"
STAGE=start
PREV=""
FULL=""
TAG=""
DUMP=""
SWITCHED=0
TMP_DB=""
HEALTH=""
WEB_CODE=""
LOGIN_CODE=""
ME=""
T_START=$(date +%s)
unset MIGRATE_DB

dc() {
	docker compose -f "$REPO/deploy/compose.yaml" --env-file "$ROOT/env/db.env" "$@"
}

note() {
	echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*" >> "$JOURNAL" || true
}

drop_tmp_db() {
	if [ -n "$TMP_DB" ]; then
		dc exec -T db psql -X -q -U postgres -d postgres -c "DROP DATABASE IF EXISTS \"$TMP_DB\"" > /dev/null 2>&1 || true
		TMP_DB=""
	fi
}

on_exit() {
	drop_tmp_db
	if [ -n "$DUMP" ]; then
		rm -f "$DUMP.part" || true
	fi
}

on_err() {
	local rc=$?
	local result
	trap - ERR
	echo "DEPLOY_FAILED stage=$STAGE" >&2
	if [ -z "$PREV" ]; then
		result="nothing to roll back to: first deploy"
	elif ! git -C "$REPO" checkout -q --detach "${PREV#sha-}"; then
		result="ROLLBACK FAILED: checkout of $PREV failed, manual action needed"
	elif [ "$SWITCHED" != 1 ]; then
		result="repo returned to $PREV, containers untouched"
	else
		export APP_TAG="$PREV"
		if printf 'APP_TAG=%s\n' "$PREV" > "$STATE/release.env" \
			&& dc up -d --wait --wait-timeout 120 api web \
			&& dc up -d --no-deps caddy \
			&& dc exec -T caddy caddy reload --config /etc/caddy/Caddyfile; then
			result="rolled back to $PREV"
		else
			result="ROLLBACK FAILED: manual action needed"
		fi
	fi
	echo "$result" >&2
	note "FAILED stage=$STAGE from=${PREV:-none} to=${TAG:-none} switched=$SWITCHED result=\"$result\" sec=$(( $(date +%s) - T_START ))"
	drop_tmp_db
	exit "$rc"
}

trap on_err ERR
trap on_exit EXIT

smoke_ok() {
	HEALTH=$(curl -s --max-time 10 --resolve dv-lab.dev:443:127.0.0.1 "$SITE/healthz") || HEALTH=""
	WEB_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 --resolve dv-lab.dev:443:127.0.0.1 "$SITE/") || WEB_CODE=""
	LOGIN_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 --resolve dv-lab.dev:443:127.0.0.1 "$SITE/login") || LOGIN_CODE=""
	ME=$(curl -s -w ' %{http_code}' --max-time 10 --resolve dv-lab.dev:443:127.0.0.1 "$SITE/api/auth/me") || ME=""
	case "$HEALTH" in
		*"\"sha\":\"$FULL\""*) ;;
		*) return 1 ;;
	esac
	case "$HEALTH" in
		*'"db":"ok"'*) ;;
		*) return 1 ;;
	esac
	case "$WEB_CODE" in
		200 | 307) ;;
		*) return 1 ;;
	esac
	[ "$LOGIN_CODE" = 200 ] || return 1
	case "$ME" in
		*'"code":"unauthenticated"'*' 401') ;;
		*) return 1 ;;
	esac
}

mkdir -p "$STATE"
install -d -m 700 "$DUMPS"

STAGE=lock
exec 9> /run/lock/dv-lab-deploy.lock
if ! flock -n 9; then
	echo "DEPLOY_STOPPED: another deploy is running"
	exit 75
fi

STAGE=current
if [ -f "$STATE/release.env" ]; then
	PREV=$(sed -n 's/^APP_TAG=//p' "$STATE/release.env")
fi

STAGE=fetch
git -C "$REPO" fetch -q origin
FULL=$(git -C "$REPO" rev-parse "$REF^{commit}")
TAG="sha-$FULL"
echo "current: ${PREV:-none}, target: $TAG ($REF)"
if [ "$TAG" = "$PREV" ] && [ "${FORCE:-0}" != 1 ]; then
	echo "DEPLOY_SKIPPED: $TAG is already live"
	exit 0
fi
git -C "$REPO" checkout -q --detach "$FULL"
export APP_TAG="$TAG"

STAGE=images
i=0
until docker manifest inspect "$IMAGES-api:$TAG" > /dev/null 2>&1 && docker manifest inspect "$IMAGES-web:$TAG" > /dev/null 2>&1; do
	i=$((i + 1))
	if [ "$i" -ge 60 ]; then
		echo "images $IMAGES-api:$TAG and $IMAGES-web:$TAG are not published after 10 minutes" >&2
		false
	fi
	sleep 10
done
dc pull api web

STAGE=db-up
dc up -d --wait db

STAGE=ensure-db
dc exec -T db /deploy/postgres/ensure-db.sh

STAGE=pre-dump
DUMP="$DUMPS/predeploy-$(date -u +%Y%m%d-%H%M%S)-${FULL:0:12}.dump"
(umask 077 && dc exec -T db pg_dump -U postgres -d dvlab -Fc > "$DUMP.part")
dc exec -T db pg_restore --list < "$DUMP.part" > /dev/null
mv "$DUMP.part" "$DUMP"
echo "pre-deploy dump: $DUMP"

STAGE=dry-run
TMP_DB="dvlab_migcheck_$(date +%s)"
dc exec -T db psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$TMP_DB\" OWNER dvlab_migrator"
dc exec -T db pg_restore -U postgres -d "$TMP_DB" --exit-on-error < "$DUMP"
MIGRATE_DB="$TMP_DB" dc --profile tools run --rm -T migrate
drop_tmp_db

STAGE=migrate
dc --profile tools run --rm -T migrate

STAGE=switch
printf 'APP_TAG=%s\n' "$TAG" > "$STATE/release.env"
SWITCHED=1
dc up -d --wait --wait-timeout 120 api web
dc up -d --no-deps caddy
dc exec -T caddy caddy reload --config /etc/caddy/Caddyfile

STAGE=smoke
i=0
until smoke_ok; do
	i=$((i + 1))
	if [ "$i" -ge 12 ]; then
		echo "smoke failed: healthz=${HEALTH:-empty} web=${WEB_CODE:-none} login=${LOGIN_CODE:-none} me=${ME##* }" >&2
		false
	fi
	sleep 5
done
echo "smoke: healthz=$HEALTH web=$WEB_CODE login=$LOGIN_CODE me=${ME##* }"
SWITCHED=0
note "OK from=${PREV:-none} to=$TAG ref=$REF sec=$(( $(date +%s) - T_START ))"

STAGE=cleanup
trap - ERR
find "$DUMPS" -maxdepth 1 -name 'predeploy-*.dump' -mtime +30 -delete || true
for repo in "$IMAGES-api" "$IMAGES-web"; do
	tags=$(docker image ls "$repo" --format '{{.Tag}}' 2> /dev/null) || tags=""
	while read -r t; do
		if [ -n "$t" ] && [ "$t" != "<none>" ] && [ "$t" != "$TAG" ] && [ "$t" != "$PREV" ]; then
			docker image rm "$repo:$t" > /dev/null 2>&1 || true
		fi
	done <<< "$tags"
done
echo "DEPLOY_OK ${PREV:-none} -> $TAG"
