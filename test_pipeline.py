import asyncio
import websockets
import json

async def test_pipeline():
    uri = "ws://127.0.0.1:8000/ws/episode"
    print(f"Connecting to {uri}...")
    async with websockets.connect(uri) as ws:
        print("Connected! Sending start_episode...")
        await ws.send(json.dumps({
            "action": "start_episode",
            "show_name": "The Office",
            "episode_prompt": "Dwight installs an AI surveillance camera disguised as a stapler.",
            "lines_per_scene": 2
        }))
        
        events_seen = set()
        for i in range(12):
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=35.0)
                event = json.loads(raw)
                etype = event.get("type")
                events_seen.add(etype)
                print(f"[{i+1}] Event: {etype}")
                if etype == "show_bible_ready":
                    bible = event.get("data", {})
                    print(f"   Episode Title: \"{bible.get('episode_title')}\"")
                    print(f"   Characters: {[c['name'] for c in bible.get('characters', [])]}")
                elif etype == "dialogue_line":
                    d = event.get("data", {})
                    print(f"   SPEECH -> {d.get('speaker_name')}: \"{d.get('speech')}\"")
                    print(f"   INNER MONOLOGUE -> \"{d.get('inner_thought')}\"")
                    print(f"   AUDIENCE CUE -> {d.get('audience_reaction')}")
            except asyncio.TimeoutError:
                print("Timeout waiting for next event.")
                break
        
        print("\nPipeline test complete! Events captured:", events_seen)

if __name__ == "__main__":
    asyncio.run(test_pipeline())
