import os
import json
import logging
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import hashlib
import openai
import uvicorn
from agents.config import PORT, HOST, check_api_keys, OPENAI_API_KEY, TTS_MODEL, AUDIO_CACHE_DIR, CHARACTER_VOICES
from agents.orchestrator import EpisodeOrchestrator

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("sitcom.server")

app = FastAPI(title="The AI Sitcom Studio")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/css", StaticFiles(directory=str(STATIC_DIR / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(STATIC_DIR / "js")), name="js")

openai_client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY, timeout=40, max_retries=0) if OPENAI_API_KEY else None

class TTSRequest(BaseModel):
    text: str
    voice: str = "fable"
    speaker_name: str = ""

@app.get("/")
async def get_index():
    return FileResponse(str(STATIC_DIR / "index.html"))

@app.get("/api/health")
async def health_check():
    key_status = check_api_keys()
    return {
        "status": "online",
        "api_keys_configured": key_status,
        "tts_model": TTS_MODEL,
        "available_voices": CHARACTER_VOICES
    }

@app.post("/api/tts")
async def synthesize_speech(req: TTSRequest):
    """
    Synthesizes speech audio using OpenAI TTS-1-HD (fable, onyx, echo, nova, alloy).
    Caches audio to disk so downstream voice changers/cloners can process the wav/mp3 files.
    """
    clean_text = req.text.strip()
    if not clean_text:
        return {"status": "error", "message": "Empty speech text"}

    voice = req.voice.lower() if req.voice.lower() in CHARACTER_VOICES else "fable"
    
    delivery = {
        "fable": "Warm, theatrical storyteller with playful changes in emphasis.",
        "onyx": "Low, firm, overly serious delivery with deliberate pauses.",
        "echo": "Relaxed, dry deadpan with understated sarcasm.",
        "nova": "Bright, quick, energetic conversational delivery.",
        "alloy": "Grounded and conversational with wry comedic timing.",
        "shimmer": "Expressive, curious, animated delivery with musical inflection."
    }[voice]
    instructions = "Perform a sitcom table read as a natural human actor. React emotionally to the line; use conversational rhythm, breath, and comedic timing. Speak only the supplied dialogue. " + delivery

    # Include the model and direction so old voice clips aren't reused.
    text_hash = hashlib.md5(f"{TTS_MODEL}_{voice}_{instructions}_{clean_text}".encode("utf-8")).hexdigest()[:16]
    clean_speaker = "".join(c for c in req.speaker_name if c.isalnum() or c in (' ', '_')).strip().replace(' ', '_')
    filename = f"{clean_speaker}_{voice}_{text_hash}.mp3" if clean_speaker else f"{voice}_{text_hash}.mp3"
    file_path = AUDIO_CACHE_DIR / filename

    # Return cached if exists
    if file_path.exists() and file_path.stat().st_size > 0:
        return {
            "status": "ok",
            "audio_url": f"/static/audio_cache/{filename}",
            "cached": True,
            "voice": voice
        }

    if not openai_client:
        return {
            "status": "error",
            "message": "AI voices are unavailable: configure the OpenAI API key.",
            "audio_url": None,
            "voice": voice
        }

    try:
        response = await openai_client.audio.speech.create(
            model=TTS_MODEL,
            voice=voice,
            input=clean_text,
            instructions=instructions,
            response_format="mp3"
        )
        # Write to static audio cache
        content = await response.aread() if hasattr(response, "aread") else response.content
        with open(file_path, "wb") as f:
            f.write(content)

        return {
            "status": "ok",
            "audio_url": f"/static/audio_cache/{filename}",
            "cached": False,
            "voice": voice
        }
    except Exception as e:
        logger.warning(f"AI speech generation failed: {e}")
        status = getattr(e, "status_code", None)
        if status == 429:
            message = "AI voice generation is unavailable: check the OpenAI account credits or rate limit."
        elif status in (401, 403):
            message = "AI voice generation is unavailable: check the API key and speech-model access."
        else:
            message = "AI voice generation failed. Please retry; details are in the server log."
        return {
            "status": "error",
            "message": message,
            "audio_url": None,
            "voice": voice
        }


@app.websocket("/ws/episode")
async def websocket_episode_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket client connected to Sitcom Studio.")
    current_orchestrator = None

    try:
        while True:
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)
            action = data.get("action")

            if action == "start_episode":
                show_name = data.get("show_name", "The Office").strip()
                episode_prompt = data.get("episode_prompt", "").strip()
                lines_per_scene = int(data.get("lines_per_scene", 12))

                logger.info(f"Starting episode generation for '{show_name}' with prompt: '{episode_prompt}'")

                async def emit_event(event_dict):
                    try:
                        await websocket.send_text(json.dumps(event_dict))
                    except Exception as err:
                        logger.warning(f"Error sending ws frame: {err}")

                current_orchestrator = EpisodeOrchestrator(emit_callback=emit_event)
                await current_orchestrator.run_episode(
                    show_name=show_name,
                    episode_prompt=episode_prompt,
                    lines_per_scene=max(6, min(lines_per_scene, 30)),
                    guest_name=str(data.get("guest_name", "")).strip()[:120]
                )

            elif action == "stop_episode":
                if current_orchestrator:
                    current_orchestrator.stop()
                    await websocket.send_text(json.dumps({"type": "status", "message": "Episode stopped by user."}))

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected.")
        if current_orchestrator:
            current_orchestrator.stop()
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
        except:
            pass

if __name__ == "__main__":
    logger.info(f"Starting Sitcom Studio on http://{HOST}:{PORT}")
    uvicorn.run("server:app", host=HOST, port=PORT, reload=True)
