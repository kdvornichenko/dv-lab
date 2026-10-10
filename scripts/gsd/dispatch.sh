PHASE="$1"
case "$PHASE" in
  ''|*[!0-9]*) echo "usage: bash scripts/gsd/dispatch.sh <phase number>" >&2; exit 1 ;;
esac
node "$HOME/.claude/gsd-core/bin/gsd-tools.cjs" query dispatch-isolation --raw --phase "$PHASE" --force-isolation none
