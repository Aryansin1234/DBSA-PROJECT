#!/usr/bin/env bash
# =====================================================================
# MediTrack — one-command launcher
# Brings up Postgres + Redis + FastAPI backend + React frontend,
# waits for health, seeds on first run, then streams live logs.
# Ctrl-C cleanly stops all containers.
# =====================================================================
set -uo pipefail   # -e intentionally omitted so cleanup never aborts mid-way

# ----- pretty output helpers -----
GREEN="\033[0;32m"; BLUE="\033[0;34m"; YELLOW="\033[1;33m"; RED="\033[0;31m"
CYAN="\033[0;36m"; BOLD="\033[1m"; NC="\033[0m"
info()  { echo -e "${BLUE}▸${NC} $1"; }
ok()    { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}!${NC} $1"; }
err()   { echo -e "${RED}✗${NC} $1"; }

cd "$(dirname "$0")"

# ----- pick docker compose command (v2 plugin vs legacy) -----
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  err "Docker Compose not found. Please install Docker Desktop."
  exit 1
fi

# ----- ensure the Docker daemon is running -----
if ! docker info >/dev/null 2>&1; then
  err "The Docker daemon is not running. Start Docker Desktop and retry."
  exit 1
fi

# ----- graceful shutdown on Ctrl-C or SIGTERM -----
# Runs in a subshell so errexit can't abort it; always exits 0.
_shutdown() {
  echo ""
  echo -e "${YELLOW}▸${NC} Stopping containers…"
  # Stop each container: send SIGTERM, wait up to 5 s, then SIGKILL.
  # Using 'stop' first gives Node/uvicorn a clean exit before 'down' removes networks.
  $DC stop --timeout 5 2>/dev/null || true
  $DC down --timeout 5  2>/dev/null || true
  echo -e "${GREEN}✓${NC} MediTrack stopped. Goodbye."
}

cleanup() {
  ( _shutdown )
  exit 0
}
trap cleanup INT TERM

# ----- banner -----
echo ""
echo -e "${GREEN}${BOLD}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║        MediTrack — Clinical Suite           ║${NC}"
echo -e "${GREEN}${BOLD}╚════════════════════════════════════════════╝${NC}"
echo ""

# ----- build & start the stack -----
info "Building and starting containers…"
$DC up -d --build

# ----- wait for Postgres -----
info "Waiting for PostgreSQL…"
for i in $(seq 1 30); do
  if $DC exec -T db pg_isready -U meditrack >/dev/null 2>&1; then
    ok "PostgreSQL ready."
    break
  fi
  printf "  ${CYAN}pg${NC} retry %d/30…\r" "$i"
  sleep 2
  [ "$i" -eq 30 ] && { err "PostgreSQL did not become ready in time."; cleanup; }
done

# ----- wait for backend /health -----
info "Waiting for backend API…"
for i in $(seq 1 30); do
  if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
    ok "Backend API up."
    break
  fi
  printf "  ${CYAN}api${NC} retry %d/30…\r" "$i"
  sleep 2
  [ "$i" -eq 30 ] && warn "Backend health check timed out (may still be starting)."
done

# ----- seed once -----
if [ ! -f .seeded ]; then
  info "Seeding demo data (patients, doctors, appointments)…"
  if $DC exec -T backend python -m app.seed; then
    touch .seeded
    ok "Database seeded."
  else
    warn "Seeding failed — retry with:  $DC exec backend python -m app.seed"
  fi
else
  ok "Database already seeded (delete '.seeded' to re-seed)."
fi

# ----- ready banner -----
echo ""
echo -e "${GREEN}${BOLD}────────────────────────────────────────────────${NC}"
ok "MediTrack is running!"
echo ""
echo -e "  ${BLUE}Frontend${NC}   →  http://localhost:5173"
echo -e "  ${BLUE}API Docs${NC}   →  http://localhost:8000/docs"
echo -e "  ${BLUE}Health${NC}     →  http://localhost:8000/health"
echo ""
echo -e "  ${YELLOW}Login${NC}      admin@meditrack.dev  /  Admin@123"
echo -e "${GREEN}${BOLD}────────────────────────────────────────────────${NC}"
echo ""
echo -e "  ${CYAN}Streaming live logs — press Ctrl-C to stop everything${NC}"
echo ""

# ----- stream logs (blocks until Ctrl-C) -----
# --no-log-prefix if available removes the service-name colour prefix duplication
$DC logs --follow --tail=50 2>&1 | sed \
  -e "s/^backend[[:space:]]*|/${GREEN}backend${NC} │/" \
  -e "s/^frontend[[:space:]]*|/${BLUE}frontend${NC} │/" \
  -e "s/^db[[:space:]]*|/${CYAN}db${NC}      │/" \
  -e "s/^redis[[:space:]]*|/${YELLOW}redis${NC}   │/" &

LOGS_PID=$!

# Wait for the log tail to end (it won't until killed).
# Re-arm cleanup now that we have the log child PID.
cleanup() {
  ( kill "$LOGS_PID" 2>/dev/null || true
    wait "$LOGS_PID" 2>/dev/null || true
    _shutdown )
  exit 0
}
trap cleanup INT TERM

wait "$LOGS_PID"
