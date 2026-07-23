#!/bin/bash
cd ~/bloom
git fetch origin main

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
  echo "$(date): New commit $REMOTE detected, checking CI status..."

  CHECKS=$(curl -s "https://api.github.com/repos/mintthiha/bloom/commits/$REMOTE/check-runs")
  TOTAL=$(echo "$CHECKS" | jq '.total_count')

  if [ "$TOTAL" -eq 0 ]; then
    echo "$(date): No CI results yet for $REMOTE, will check again next cycle."
    exit 0
  fi

  INCOMPLETE=$(echo "$CHECKS" | jq '[.check_runs[] | select(.status != "completed")] | length')
  if [ "$INCOMPLETE" -gt 0 ]; then
    echo "$(date): CI still running for $REMOTE, will check again next cycle."
    exit 0
  fi

  FAILED=$(echo "$CHECKS" | jq '[.check_runs[] | select(.conclusion != "success")] | length')
  if [ "$FAILED" -gt 0 ]; then
    echo "$(date): CI FAILED for commit $REMOTE — skipping deploy."
    exit 0
  fi

  echo "$(date): CI passed for $REMOTE. Backing up database..."
  docker compose exec -T db pg_dump -U postgres bloom > ~/bloom/backups/backup-$(date +%Y%m%d-%H%M%S).sql
  ls -t ~/bloom/backups/*.sql | tail -n +11 | xargs -r rm

  echo "$(date): Deploying commit $(git rev-parse --short $REMOTE) - $(git log -1 --format=%s $REMOTE)"
  git pull origin main
  docker compose up -d --build
  echo "$(date): Deploy complete. Now running commit $(git rev-parse --short HEAD)"
fi
