# ArgueNet

Multi-agent debate system built with LangChain and Claude.

## Setup

```bash
python -m pip install -r requirements.txt
export ANTHROPIC_API_KEY="..."
export TAVILY_API_KEY="..."
export REDDIT_CLIENT_ID="..."
export REDDIT_CLIENT_SECRET="..."
export REDDIT_USER_AGENT="arguenet"
```

## Run

```bash
python -m arguenet.main "Should remote work be default for software teams?"
```

The debate entry point is [arguenet/main.py](arguenet/main.py).
