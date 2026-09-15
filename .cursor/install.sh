#!/usr/bin/env bash
# Cloud Agent install phase for Anymarkt (qbet).
# Idempotent: installs the toolchain the repo's local stack needs (Docker for
# local Supabase, the Supabase CLI, Deno for edge-function tests, psql) and the
# Node dependencies. Safe to run repeatedly and against cached state.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

log() { echo "[install] $*"; }

# ── System packages ────────────────────────────────────────────────────────
NEED_APT=0
for bin in docker fuse-overlayfs psql slirp4netns; do
  command -v "$bin" >/dev/null 2>&1 || NEED_APT=1
done
if [[ "$NEED_APT" == "1" ]]; then
  log "Installing system packages (docker.io, fuse-overlayfs, uidmap, slirp4netns, postgresql-client)"
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    -o Dpkg::Options::=--force-confold \
    docker.io fuse-overlayfs uidmap slirp4netns postgresql-client ca-certificates curl
fi

# Allow the agent user to talk to the Docker daemon.
sudo groupadd -f docker
sudo usermod -aG docker "$(id -un)" || true

# ── Supabase CLI ───────────────────────────────────────────────────────────
if ! command -v supabase >/dev/null 2>&1; then
  log "Installing Supabase CLI"
  LATEST="$(curl -fsSL https://api.github.com/repos/supabase/cli/releases/latest \
    | grep -oP '"tag_name":\s*"\K[^"]+')"
  curl -fsSL -o /tmp/supabase.deb \
    "https://github.com/supabase/cli/releases/download/${LATEST}/supabase_${LATEST#v}_linux_amd64.deb"
  sudo dpkg -i /tmp/supabase.deb
  rm -f /tmp/supabase.deb
fi

# ── Deno (edge-function unit tests) ────────────────────────────────────────
if ! command -v deno >/dev/null 2>&1; then
  log "Installing Deno"
  curl -fsSL https://deno.land/install.sh | DENO_INSTALL="$HOME/.deno" sh -s -- -y
  sudo ln -sf "$HOME/.deno/bin/deno" /usr/local/bin/deno
fi

# ── Node dependencies ──────────────────────────────────────────────────────
log "Installing Node dependencies (npm ci)"
npm ci

# ── Best-effort: warm the Supabase Docker images so first boot is fast ──────
# Skipped silently if the build phase cannot run a nested daemon; start.sh will
# pull the images on first boot instead.
if bash .cursor/docker-up.sh >/dev/null 2>&1; then
  log "Warming Supabase Docker images (best-effort)"
  supabase start >/dev/null 2>&1 && supabase stop --no-backup >/dev/null 2>&1 || true
else
  log "Skipping image warm-up (no nested Docker during install)"
fi

log "install complete"
