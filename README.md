# ArgueNet

Multi-agent debate system built with LangChain and OpenRouter-backed models.

## Setup

```bash
python -m pip install -r requirements.txt

export OPENROUTER_API_KEY="..."
export OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"
export ARGUENET_MODEL="openai/gpt-4o-mini"
export TAVILY_API_KEY="..."
export REDDIT_CLIENT_ID="..."
export REDDIT_CLIENT_SECRET="..."
export REDDIT_USER_AGENT="arguenet"
```

## Run (CLI — direct mode)

```bash
python -m arguenet.main "Should remote work be default for software teams?"
```

The debate entry point is [arguenet/main.py](arguenet/main.py).

---

## Kafka Messaging Layer

The Kafka layer replaces direct Python function calls between agents with
async message passing over three Kafka topics. Each agent publishes its
output to Kafka and the coordinator collects responses before advancing
to the next phase.

### Topics

| Topic | Direction | Purpose |
|---|---|---|
| `arguenet.debate.control` | coordinator → agents | Phase signals (argue, score, rebut, terminate) |
| `arguenet.debate.arguments` | debate agents → coordinator | Arguments and counterarguments |
| `arguenet.debate.evaluations` | moderator → coordinator | Moderator scores per agent |

### Round lifecycle

```
coordinator → control(argue)
    debate agents invoke LLMs concurrently → publish to arguments topic

coordinator → control(score)
    moderator invokes LLM → publish scores to evaluations topic

coordinator → control(rebut)
    debate agents rebut using moderator feedback → publish to arguments topic

coordinator scores rebuttals → termination check → loop or stop
```

### Message schema

Every Kafka message is wrapped in a `MessageEnvelope`:

```json
{
  "message_id": "<uuid>",
  "debate_id": "<uuid>",
  "round_number": 1,
  "message_type": "argument | counterargument | evaluation | control",
  "sender_id": "advocate | skeptic | devils_advocate | empiricist | moderator | coordinator",
  "target_ids": [],
  "timestamp": "2026-04-19T00:00:00+00:00",
  "payload": {}
}
```

`payload` holds a serialised `Argument`, `ModeratorScore`, or `ControlPayload`
depending on `message_type`.

### Prerequisites

**Kafka 4.x via Homebrew (Mac):**

```bash
brew install kafka
brew services start kafka
```

**Create the three topics** (one-time setup):

```bash
kafka-topics --bootstrap-server localhost:9092 \
  --create --topic arguenet.debate.control \
  --partitions 1 --replication-factor 1

kafka-topics --bootstrap-server localhost:9092 \
  --create --topic arguenet.debate.arguments \
  --partitions 1 --replication-factor 1

kafka-topics --bootstrap-server localhost:9092 \
  --create --topic arguenet.debate.evaluations \
  --partitions 1 --replication-factor 1

# Confirm
kafka-topics --bootstrap-server localhost:9092 --list
```

### Run (Kafka mode)

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export TAVILY_API_KEY="tvly-..."
export KAFKA_BOOTSTRAP_SERVERS="localhost:9092"
export ARGUENET_MODEL="claude-haiku-4-5-20251001"   # cheaper model for testing
export ARGUENET_MAX_ROUNDS="2"                       # fewer rounds = faster + cheaper

python -m arguenet.kafka_main "Should remote work be default for software teams?"
```

### Smoke test (no API keys needed)

Verifies Kafka topics and producer/consumer wiring before spending API credits:

```bash
python3 -c "
from arguenet.messaging.producer import ArgueNetProducer
from arguenet.messaging.consumer import ArgueNetConsumer
from arguenet.messaging.schema import MessageEnvelope
from arguenet.messaging.topics import ARGUMENTS_TOPIC
import time, uuid

debate_id = 'test-' + str(uuid.uuid4())[:8]
group_id  = 'test-group-' + str(uuid.uuid4())[:8]

consumer = ArgueNetConsumer([ARGUMENTS_TOPIC], group_id, auto_offset_reset='latest')
consumer.poll(timeout_ms=5000)   # warmup — forces partition assignment

with ArgueNetProducer() as p:
    msg = MessageEnvelope(
        debate_id=debate_id, round_number=1,
        message_type='argument', sender_id='advocate',
        payload={'test': True}
    )
    p.send(ARGUMENTS_TOPIC, msg)
    print('sent:', msg.message_id)

msgs = consumer.poll(timeout_ms=5000, debate_id=debate_id)
print('received:', len(msgs), 'message(s)')
for m in msgs:
    print(' -', m.sender_id, m.message_type, m.payload)
consumer.close()
"
```

Expected output:
```
sent: <uuid>
received: 1 message(s)
 - advocate argument {'test': True}
```

### Watch live traffic

Open extra terminal tabs before running a debate to see messages flow in real time:

```bash
# arguments topic
kafka-console-consumer --bootstrap-server localhost:9092 \
  --topic arguenet.debate.arguments --from-beginning

# control signals
kafka-console-consumer --bootstrap-server localhost:9092 \
  --topic arguenet.debate.control --from-beginning
```

### Messaging layer files

```
arguenet/messaging/
    schema.py      # MessageEnvelope, ControlPayload, MessageType, Phase
    topics.py      # Topic constants and per-role routing table
    producer.py    # ArgueNetProducer (confluent-kafka wrapper)
    consumer.py    # ArgueNetConsumer (confluent-kafka wrapper)
    router.py      # message_type_for_phase(), agents_for_phase(), rebuttal_targets()

arguenet/kafka_main.py   # Kafka-driven debate runner
```

> **Note:** The Kafka layer requires `confluent-kafka` (listed in `requirements.txt`).
> `confluent-kafka` 2.x requires `"group.protocol": "classic"` when connecting to
> Kafka 4.x, which is already configured in `arguenet/messaging/consumer.py`.
