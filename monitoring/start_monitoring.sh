#!/usr/bin/env bash
set -e

echo "Starting ArgueNet monitoring stack..."

# kafka_exporter
if pgrep -x kafka_exporter > /dev/null; then
  echo "kafka_exporter already running"
else
  nohup kafka_exporter --kafka.server=localhost:9092 > /tmp/kafka_exporter.log 2>&1 &
  echo "kafka_exporter started (PID $!)"
fi

# Prometheus
brew services start prometheus 2>/dev/null || true
echo "Prometheus running at http://localhost:9090"

# Grafana
brew services start grafana 2>/dev/null || true
echo "Grafana running at http://localhost:3000  (admin / admin)"

echo ""
echo "Next: open http://localhost:3000 and import dashboard ID 7589"
