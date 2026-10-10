PINNED_ROOT="$1"
case "$PINNED_ROOT" in
  /*) ;;
  *) echo "FATAL: usage: bash scripts/gsd/root-pin.sh <absolute worktree path>" >&2; exit 1 ;;
esac
ACTUAL_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
PINNED_TL=$(cd "$PINNED_ROOT" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$ACTUAL_ROOT" ] || [ -z "$PINNED_TL" ] || [ "$ACTUAL_ROOT" != "$PINNED_TL" ]; then
  echo "FATAL: executor root does not match the pinned worktree." >&2
  echo "  pinned: ${PINNED_TL:-<unresolved>}" >&2
  echo "  actual: ${ACTUAL_ROOT:-<none>}" >&2
  echo "  No writes or commits are permitted from this checkout. HALT and report." >&2
  exit 1
fi
echo "ROOT_PIN_OK"
