"""
ArgueNet Kafka stress test — creates measurable stability issues.

Scenarios
---------
  burst      : flood all topics as fast as possible → message rate spike
  lag        : produce faster than a slow consumer can drain → consumer lag alert
  partition  : saturate a single partition → uneven load across brokers
  sustained  : steady high-volume load for N seconds → sustained pressure

Usage:
    python monitoring/stress_test.py --scenario burst
    python monitoring/stress_test.py --scenario lag --duration 30
    python monitoring/stress_test.py --scenario sustained --duration 60 --rate 100
"""
import argparse
import json
import os
import sys
import time
import threading
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from arguenet.messaging.producer import ArgueNetProducer
from arguenet.messaging.consumer import ArgueNetConsumer
from arguenet.messaging.schema import ControlPayload, MessageEnvelope
from arguenet.messaging.topics import ARGUMENTS_TOPIC, CONTROL_TOPIC, EVALUATIONS_TOPIC

AGENTS = ["advocate", "skeptic", "devils_advocate", "empiricist"]
TOPICS = [ARGUMENTS_TOPIC, CONTROL_TOPIC, EVALUATIONS_TOPIC]


def _fake_argument(agent: str, round_num: int, debate_id: str) -> MessageEnvelope:
    return MessageEnvelope(
        debate_id=debate_id,
        round_number=round_num,
        message_type="argument",
        sender_id=agent,
        payload={
            "agent_id": agent,
            "round": round_num,
            "argument": f"Stress test argument from {agent}",
            "claims": ["stress claim"],
            "confidence": 0.7,
            "sources": [],
        },
    )


def _fake_evaluation(agent: str, round_num: int, debate_id: str) -> MessageEnvelope:
    return MessageEnvelope(
        debate_id=debate_id,
        round_number=round_num,
        message_type="evaluation",
        sender_id="moderator",
        target_ids=[agent],
        payload={"agent_id": agent, "round": round_num, "weighted_score": 0.7},
    )


# ── Scenario 1: Burst ─────────────────────────────────────────────────────────

def scenario_burst(producer: ArgueNetProducer, count: int = 500):
    """Send as many messages as possible as fast as possible."""
    print(f"\n[BURST] Sending {count} messages with no delay...")
    debate_id = str(uuid.uuid4())
    sent = 0
    start = time.monotonic()

    for i in range(count):
        agent = AGENTS[i % len(AGENTS)]
        topic = TOPICS[i % len(TOPICS)]
        env = _fake_argument(agent, (i // 10) + 1, debate_id)
        producer.send(topic, env)
        sent += 1

    elapsed = time.monotonic() - start
    print(f"[BURST] {sent} messages in {elapsed:.2f}s = {sent/elapsed:.0f} msg/s")
    print(f"[BURST] Check Grafana → 'Messages in per second' should show a sharp spike")


# ── Scenario 2: Consumer Lag ──────────────────────────────────────────────────

def scenario_lag(duration: int = 30):
    """
    Producer floods the arguments topic; slow consumer reads at 1 msg/s.
    Consumer group lag should climb and trigger the alert.
    """
    print(f"\n[LAG] Running for {duration}s — producer fast, consumer slow...")
    debate_id = str(uuid.uuid4())
    group_id  = f"stress-lag-{uuid.uuid4()}"
    stop_event = threading.Event()
    produced = [0]

    def fast_producer():
        with ArgueNetProducer(os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")) as p:
            round_num = 1
            while not stop_event.is_set():
                for agent in AGENTS:
                    p.send(ARGUMENTS_TOPIC, _fake_argument(agent, round_num, debate_id))
                    produced[0] += 1
                round_num += 1
                time.sleep(0.05)   # 20 rounds/s = 80 msg/s

    def slow_consumer():
        with ArgueNetConsumer([ARGUMENTS_TOPIC], group_id=group_id,
                              bootstrap_servers=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
                              auto_offset_reset="latest") as c:
            # Warm up partition assignment
            deadline = time.monotonic() + 8
            while time.monotonic() < deadline:
                c.poll(timeout_ms=500)
                if c._consumer.assignment():
                    break
            while not stop_event.is_set():
                c.poll(timeout_ms=500)
                time.sleep(1)   # deliberately slow — 1 poll/s

    t_prod = threading.Thread(target=fast_producer, daemon=True)
    t_cons = threading.Thread(target=slow_consumer, daemon=True)
    t_prod.start()
    t_cons.start()

    for remaining in range(duration, 0, -5):
        time.sleep(5)
        print(f"[LAG]  {remaining}s remaining — produced {produced[0]} messages so far")

    stop_event.set()
    print(f"[LAG] Done — total produced: {produced[0]}")
    print(f"[LAG] Check Grafana → 'Lag by Consumer Group' for group '{group_id[:16]}...'")


# ── Scenario 3: Sustained ─────────────────────────────────────────────────────

def scenario_sustained(duration: int = 60, rate: int = 50):
    """Steady message rate for N seconds — sustained pressure on the broker."""
    print(f"\n[SUSTAINED] {rate} msg/s for {duration}s...")
    delay = 1.0 / rate
    debate_id = str(uuid.uuid4())
    sent = 0
    start = time.monotonic()
    deadline = start + duration

    with ArgueNetProducer(os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")) as producer:
        i = 0
        while time.monotonic() < deadline:
            agent = AGENTS[i % len(AGENTS)]
            topic = TOPICS[i % len(TOPICS)]
            producer.send(topic, _fake_argument(agent, (i // 4) + 1, debate_id))
            sent += 1
            i += 1
            time.sleep(delay)

    elapsed = time.monotonic() - start
    print(f"[SUSTAINED] {sent} messages in {elapsed:.1f}s = {sent/elapsed:.0f} msg/s avg")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="ArgueNet Kafka stress test")
    parser.add_argument("--scenario", choices=["burst", "lag", "sustained"], default="burst")
    parser.add_argument("--duration", type=int, default=30, help="Seconds (lag/sustained only)")
    parser.add_argument("--count",    type=int, default=500, help="Message count (burst only)")
    parser.add_argument("--rate",     type=int, default=50,  help="Msg/s (sustained only)")
    args = parser.parse_args()

    print("=" * 60)
    print("ArgueNet Kafka Stress Test")
    print(f"Scenario : {args.scenario}")
    print(f"Open Grafana at http://localhost:3000 to watch metrics")
    print("=" * 60)

    if args.scenario == "burst":
        with ArgueNetProducer(os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")) as producer:
            scenario_burst(producer, args.count)

    elif args.scenario == "lag":
        scenario_lag(args.duration)

    elif args.scenario == "sustained":
        scenario_sustained(args.duration, args.rate)


if __name__ == "__main__":
    main()
