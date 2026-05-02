import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

api_key = os.getenv("OPENROUTER_API_KEY")
model = os.getenv("ARGUENET_MODEL", "openai/gpt-4o-mini")

client = OpenAI(
    api_key=api_key,
    base_url="https://openrouter.ai/api/v1",
)

response = client.chat.completions.create(
    model=model,
    messages=[{"role": "user", "content": "I want you tell me how to tie my shoes."}],
)

print(response.choices[0].message.content)
