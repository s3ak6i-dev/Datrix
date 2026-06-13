#!/usr/bin/env bash
# scripts/backup.sh — Back up the Datrix backend_data Docker volume.
#
# Usage:
#   bash scripts/backup.sh                  # saves to ./backups/
#   bash scripts/backup.sh /path/to/output  # saves to a custom directory
#
# Environment variables:
#   COMPOSE_PROJECT   Docker Compose project name (default: datrix)
#   KEEP_DAYS         Number of days to keep backups (default: 7)
#
# Cron example (daily at 2 AM, logged):
#   0 2 * * * cd /opt/datrix && bash scripts/backup.sh >> /var/log/datrix-backup.log 2>&1
#
# Restore example:
#   docker run --rm \
#     -v datrix_backend_data:/data \
#     -v $(pwd)/backups:/backup:ro \
#     alpine tar xzf /backup/datrix_volume_20240101_020000.tar.gz -C /data

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-datrix}"
VOLUME_NAME="${COMPOSE_PROJECT}_backend_data"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS="${KEEP_DAYS:-7}"

log() { echo "[$(date -Iseconds)] $*"; }

mkdir -p "${BACKUP_DIR}"
BACKUP_ABS="$(cd "${BACKUP_DIR}" && pwd)"

# ── 1. Verify volume exists ────────────────────────────────────────────────────
if ! docker volume inspect "${VOLUME_NAME}" &>/dev/null; then
    log "ERROR: volume '${VOLUME_NAME}' not found."
    log "  Is the stack running? Check: docker volume ls | grep ${COMPOSE_PROJECT}"
    log "  Override project name with: COMPOSE_PROJECT=myproject bash scripts/backup.sh"
    exit 1
fi

# ── 2. Create archive ──────────────────────────────────────────────────────────
ARCHIVE_NAME="datrix_volume_${TIMESTAMP}.tar.gz"
log "Backing up volume ${VOLUME_NAME} → ${BACKUP_DIR}/${ARCHIVE_NAME} ..."

docker run --rm \
    --volume "${VOLUME_NAME}:/data:ro" \
    --volume "${BACKUP_ABS}:/backup" \
    alpine:3 \
    tar czf "/backup/${ARCHIVE_NAME}" -C /data .

ARCHIVE_SIZE=$(du -sh "${BACKUP_ABS}/${ARCHIVE_NAME}" | cut -f1)
log "Archive created: ${ARCHIVE_NAME} (${ARCHIVE_SIZE})"

# ── 3. Prune old backups ───────────────────────────────────────────────────────
PRUNED=$(find "${BACKUP_ABS}" -name "datrix_volume_*.tar.gz" -mtime "+${KEEP_DAYS}" -print)
if [ -n "${PRUNED}" ]; then
    echo "${PRUNED}" | xargs rm -f
    COUNT=$(echo "${PRUNED}" | wc -l | tr -d ' ')
    log "Pruned ${COUNT} backup(s) older than ${KEEP_DAYS} days."
fi

log "Backup complete. Archives in ${BACKUP_ABS}:"
ls -lh "${BACKUP_ABS}"/datrix_volume_*.tar.gz 2>/dev/null | awk '{print "  " $5 "  " $9}'
