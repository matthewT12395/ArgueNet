#!/usr/bin/env python
import os
from dotenv import load_dotenv
load_dotenv()

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage

print('=== Testing Claude Model ===')
llm = ChatAnthropic(model='claude-haiku-4-5-20251001', temperature=0.7)

test_prompt = 'Return ONLY a JSON object: {"name": "test", "value": 123}'
print(f'Sending prompt...')

try:
    response = llm.invoke([HumanMessage(content=test_prompt)])
    print(f'✓ Model responded successfully')
    print(f'Response: {response.content[:300]}')
except Exception as e:
    print(f'✗ Error calling model: {e}')
    import traceback
    traceback.print_exc()
