"""
Sets up Grafana alert rules and a notification contact point for ArgueNet.

Supports:
  - Microsoft Teams  (via incoming webhook URL)
  - Email            (via SMTP)

Usage:
    # Teams
    python monitoring/setup_alerts.py --teams-webhook "https://outlook.office.com/webhook/..."

    # Email
    python monitoring/setup_alerts.py --email "you@example.com"

    # Both
    python monitoring/setup_alerts.py --teams-webhook "..." --email "you@example.com"
"""
import argparse
import json
import sys
import requests

GRAFANA_URL  = "http://localhost:3000"
GRAFANA_AUTH = ("admin", "admin")
DS_UID       = "cfkzl5hwgnytcb"   # Prometheus data source UID


def _post(path: str, body: dict) -> dict:
    r = requests.post(f"{GRAFANA_URL}{path}", json=body, auth=GRAFANA_AUTH)
    r.raise_for_status()
    return r.json()


def _put(path: str, body: dict) -> dict:
    r = requests.put(f"{GRAFANA_URL}{path}", json=body, auth=GRAFANA_AUTH)
    r.raise_for_status()
    return r.json()


# ── Contact points ─────────────────────────────────────────────────────────────

def create_teams_contact_point(webhook_url: str) -> str:
    body = {
        "name": "ArgueNet Teams",
        "type": "teams",
        "settings": {
            "url": webhook_url,
            "title": "ArgueNet Kafka Alert",
            "sectiontitle": "{{ .CommonLabels.alertname }}",
            "message": (
                "**Status:** {{ .Status }}\n\n"
                "**Alert:** {{ .CommonLabels.alertname }}\n\n"
                "**Summary:** {{ .CommonAnnotations.summary }}\n\n"
                "**Description:** {{ .CommonAnnotations.description }}\n\n"
                "**Time:** {{ .StartsAt }}"
            ),
        },
        "disableResolveMessage": False,
    }
    result = _post("/api/v1/provisioning/contact-points", body)
    uid = result.get("uid", "teams")
    print(f"  Teams contact point created (uid={uid})")
    return uid


def create_email_contact_point(to_email: str) -> str:
    body = {
        "name": "ArgueNet Email",
        "type": "email",
        "settings": {
            "addresses": to_email,
            "subject": "ArgueNet Kafka Alert: {{ .CommonLabels.alertname }}",
            "message": (
                "Alert: {{ .CommonLabels.alertname }}\n"
                "Status: {{ .Status }}\n"
                "Summary: {{ .CommonAnnotations.summary }}\n"
                "Description: {{ .CommonAnnotations.description }}"
            ),
        },
        "disableResolveMessage": False,
    }
    result = _post("/api/v1/provisioning/contact-points", body)
    uid = result.get("uid", "email")
    print(f"  Email contact point created → {to_email} (uid={uid})")
    return uid


# ── Notification policy ────────────────────────────────────────────────────────

def set_notification_policy(contact_uids: list[str]):
    receivers = [{"name": uid} for uid in contact_uids]
    body = {
        "receiver": contact_uids[0],
        "group_by": ["alertname", "topic"],
        "group_wait": "10s",
        "group_interval": "1m",
        "repeat_interval": "5m",
        "routes": [],
    }
    _put("/api/v1/provisioning/policies", body)
    print(f"  Notification policy set → receivers: {contact_uids}")


# ── Alert folder ───────────────────────────────────────────────────────────────

def get_or_create_folder() -> str:
    r = requests.get(f"{GRAFANA_URL}/api/folders", auth=GRAFANA_AUTH)
    for f in r.json():
        if f["title"] == "ArgueNet Alerts":
            return f["uid"]
    result = _post("/api/folders", {"title": "ArgueNet Alerts"})
    uid = result["uid"]
    print(f"  Created alert folder (uid={uid})")
    return uid


# ── Alert rules ────────────────────────────────────────────────────────────────

def _make_rule(folder_uid: str, title: str, expr: str, threshold: float,
               severity: str, summary: str, description: str, for_duration: str = "30s") -> dict:
    return {
        "title": title,
        "condition": "B",
        "for": for_duration,
        "folderUID": folder_uid,
        "ruleGroup": "arguenet-kafka",
        "labels": {"severity": severity},
        "annotations": {"summary": summary, "description": description},
        "data": [
            {
                "refId": "A", "queryType": "",
                "relativeTimeRange": {"from": 300, "to": 0},
                "datasourceUid": DS_UID,
                "model": {"expr": expr, "refId": "A", "intervalMs": 1000, "maxDataPoints": 43200},
            },
            {
                "refId": "B", "queryType": "",
                "relativeTimeRange": {"from": 300, "to": 0},
                "datasourceUid": "-100",
                "model": {
                    "type": "classic_conditions", "refId": "B",
                    "datasource": {"type": "__expr__", "uid": "-100"},
                    "conditions": [{
                        "evaluator": {"type": "gt", "params": [threshold]},
                        "operator": {"type": "and"},
                        "reducer": {"type": "last", "params": []},
                        "query": {"params": ["A"]},
                        "type": "query",
                    }],
                },
            },
        ],
        "noDataState": "NoData",
        "execErrState": "Error",
        "isPaused": False,
    }


def create_alert_rules(folder_uid: str, contact_name: str):
    rules = [
        _make_rule(folder_uid,
            "High Consumer Lag",
            "kafka_consumergroup_lag{topic=~\"arguenet.*\"}",
            50, "critical",
            "ArgueNet consumer group falling behind",
            "Lag > 50 — agents may be overloaded or a consumer crashed"),
        _make_rule(folder_uid,
            "Message Rate Spike",
            "sum(rate(kafka_topic_partition_current_offset{topic=~\"arguenet.*\"}[1m]))",
            80, "warning",
            "Abnormal message rate spike on ArgueNet topics",
            "Rate > 80 msg/s — possible runaway debate loop", for_duration="20s"),
        _make_rule(folder_uid,
            "Kafka Exporter Down",
            "absent(kafka_topic_partitions)",
            0, "critical",
            "kafka_exporter is not reachable",
            "No Kafka metrics for 60s — check if kafka_exporter process is running",
            for_duration="60s"),
        _make_rule(folder_uid,
            "DLQ Messages Detected",
            "kafka_topic_partition_current_offset{topic=\"arguenet.debate.dlq\"}",
            0, "warning",
            "Dead Letter Queue is growing",
            "Malformed agent payloads detected in DLQ"),
    ]

    # Fetch existing rule titles to avoid duplicates
    existing = requests.get(f"{GRAFANA_URL}/api/v1/provisioning/alert-rules", auth=GRAFANA_AUTH).json()
    existing_titles = {r["title"] for r in existing}

    for rule in rules:
        if rule["title"] in existing_titles:
            print(f"  Skipped (already exists): {rule['title']}")
            continue
        try:
            res = _post("/api/v1/provisioning/alert-rules", rule)
            print(f"  Created: {rule['title']}")
        except Exception as e:
            print(f"  Error creating '{rule['title']}': {e}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Setup ArgueNet Grafana alerts")
    parser.add_argument("--teams-webhook", help="Microsoft Teams incoming webhook URL")
    parser.add_argument("--email",         help="Email address for alerts")
    args = parser.parse_args()

    if not args.teams_webhook and not args.email:
        print("Error: provide --teams-webhook and/or --email")
        sys.exit(1)

    print("\nSetting up ArgueNet Grafana alerts...")

    contact_names = []

    if args.teams_webhook:
        print("\n[1/4] Creating Teams contact point...")
        uid = create_teams_contact_point(args.teams_webhook)
        contact_names.append("ArgueNet Teams")

    if args.email:
        print("\n[1/4] Creating Email contact point...")
        uid = create_email_contact_point(args.email)
        contact_names.append("ArgueNet Email")

    print("\n[2/4] Setting notification policy...")
    set_notification_policy(contact_names)

    print("\n[3/4] Creating alert folder...")
    folder_uid = get_or_create_folder()

    print("\n[4/4] Creating alert rules...")
    create_alert_rules(folder_uid, contact_names[0])

    print("\n" + "=" * 50)
    print("Alert rules created:")
    print("  HIGH Consumer Lag     → fires when lag > 50 messages")
    print("  Message Rate Spike    → fires when rate > 80 msg/s")
    print("  Kafka Exporter Down   → fires when exporter unreachable")
    print("  DLQ Messages Detected → fires when dead letter queue grows")
    print("\nView in Grafana: http://localhost:3000/alerting/list")
    print("=" * 50)


if __name__ == "__main__":
    main()
