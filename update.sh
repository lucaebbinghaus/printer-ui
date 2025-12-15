#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
BRANCH="${UPDATE_BRANCH:-main}"

echo "=== UPDATE START $(date -Is) ==="
echo "Project: $PROJECT_DIR"
echo "Branch:  $BRANCH"
echo

cd "$PROJECT_DIR"

echo "[1/4] git fetch"
git fetch --all --prune

echo "[2/4] git checkout + pull"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo
echo "[3/4] docker compose build"
docker compose build

echo
echo "[4/4] docker compose up -d"
docker compose up -d --remove-orphans

echo
echo "=== UPDATE DONE $(date -Is) ==="
