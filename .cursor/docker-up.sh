#!/usr/bin/env bash
# Idempotent: ensure a nested Docker daemon is running so the local Supabase
# stack can boot. Cloud Agent VMs are themselves containers, so Docker runs
# with the fuse-overlayfs storage driver and bridged traffic is exempted from
# netfilter (otherwise container<->container connections are dropped).
set -euo pipefail

# Already up (and reachable by the current user)? Nothing to do.
if docker info >/dev/null 2>&1; then
  exit 0
fi

sudo groupadd -f docker

if ! pgrep -x dockerd >/dev/null 2>&1; then
  echo "[docker-up] starting dockerd (fuse-overlayfs)"
  sudo nohup dockerd --storage-driver=fuse-overlayfs --group docker \
    >/tmp/dockerd.log 2>&1 &
fi

# Wait for the daemon socket to come up.
for _ in $(seq 1 60); do
  if sudo docker info >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Same-bridge container traffic must bypass netfilter in nested VMs, otherwise
# the Supabase services cannot reach Postgres. br_netfilter is loaded once
# dockerd creates its first bridge, so set these after the daemon is up.
sudo sysctl -w net.bridge.bridge-nf-call-iptables=0 >/dev/null 2>&1 || true
sudo sysctl -w net.bridge.bridge-nf-call-ip6tables=0 >/dev/null 2>&1 || true

# Let the agent user talk to the daemon without sudo for the rest of the session.
sudo chmod 666 /var/run/docker.sock 2>/dev/null || true

if ! docker info >/dev/null 2>&1; then
  echo "[docker-up] dockerd failed to start; last log lines:" >&2
  sudo tail -n 30 /tmp/dockerd.log >&2 || true
  exit 1
fi

echo "[docker-up] docker is ready"
