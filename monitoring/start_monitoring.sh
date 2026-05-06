#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load Grafana Cloud + Confluent Cloud credentials
if [ -f "$SCRIPT_DIR/grafana_cloud.env" ]; then
  set -a
  source "$SCRIPT_DIR/grafana_cloud.env"
  set +a
  echo "Credentials loaded"
else
  echo "WARNING: grafana_cloud.env not found — Loki push will not work"
fi

echo "Starting ArgueNet monitoring stack..."

# Kafka → Loki bridge (reads from Confluent Cloud, pushes logs to Grafana Cloud Loki)
if pgrep -f "kafka_loki_bridge" > /dev/null; then
  pkill -f "kafka_loki_bridge" 2>/dev/null || true
  sleep 1
fi
cd "$(dirname "$SCRIPT_DIR")"
PYTHONUNBUFFERED=1 nohup .venv/bin/python monitoring/kafka_loki_bridge.py > /tmp/loki_bridge.log 2>&1 &
echo "Kafka→Loki bridge started (PID $!)"

echo ""
echo "Metrics : Confluent Cloud → Grafana Cloud (managed scrape job)"
echo "Logs    : Confluent Cloud → Loki bridge → ${GRAFANA_LOKI_URL:-not set}"
echo "Dashboard: https://ashavinodhinivijayan.grafana.net"
