import sys
import anthropic
from agents.config import ANTHROPIC_API_KEY, SHOWRUNNER_MODELS

print("Starting test_claude.py...", flush=True)
client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY, timeout=12.0)
for m in SHOWRUNNER_MODELS:
    print(f"Trying {m}...", flush=True)
    try:
        r = client.messages.create(
            model=m,
            max_tokens=15,
            messages=[{"role": "user", "content": "hi"}]
        )
        print(f"SUCCESS {m}: {r.content[0].text.strip()}", flush=True)
        break
    except Exception as e:
        print(f"FAIL {m}: {e}", flush=True)
