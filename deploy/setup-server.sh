#!/usr/bin/env bash
# One-time preparation of a fresh EC2 instance (Ubuntu 22.04/24.04 or Amazon Linux 2023).
# Installs Docker with the Compose plugin and adds swap so the Maven and Next.js builds fit in memory.
# Run as the default user (ubuntu / ec2-user):  bash deploy/setup-server.sh
set -euo pipefail

. /etc/os-release
case "$ID" in
  ubuntu|debian)
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl git
    curl -fsSL https://get.docker.com | sudo sh
    ;;
  amzn)
    sudo dnf install -y docker git
    # Amazon Linux ships Docker without Compose or a recent Buildx; install both as CLI plugins.
    arch=$(uname -m); [ "$arch" = aarch64 ] && barch=arm64 || barch=amd64
    sudo mkdir -p /usr/local/lib/docker/cli-plugins
    sudo curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$arch" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    buildx=$(curl -fsSL https://api.github.com/repos/docker/buildx/releases/latest | grep -m1 '"tag_name"' | cut -d'"' -f4)
    sudo curl -fsSL "https://github.com/docker/buildx/releases/download/$buildx/buildx-$buildx.linux-$barch" \
      -o /usr/local/lib/docker/cli-plugins/docker-buildx
    sudo chmod +x /usr/local/lib/docker/cli-plugins/*
    ;;
  *) echo "Unsupported OS: $ID" >&2; exit 1 ;;
esac

sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

# The image builds need about 3 GB of memory; add a swap file on smaller instances.
mem_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$mem_mb" -lt 4000 ] && ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo
echo "Docker is ready. Log out and back in (so the docker group applies), then run deploy/deploy.sh."
