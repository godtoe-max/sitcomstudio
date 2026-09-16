# 🎬 The AI Sitcom Studio

An interactive multi-agent AI television studio that writes, directs, voices, and illustrates original sitcom episodes in real time.

---

## 🌟 Features

- **Multi-Agent Writer's Room**:
  - **Showrunner**: Outlines story arcs, beats, character objectives, and episode flow using Claude.
  - **Cast Ensemble**: Autonomous character agents acting in-character using GPT-4o.
  - **Art Director**: Generates rich editorial-style vector storyboard panels using Claude Sonnet.
  - **Audio Engine**: Synthesizes synchronized table-read speech per character via OpenAI TTS.
- **Interactive Multi-Cam Control Room**:
  - Real-time WebSocket event streaming.
  - Script table-read playback with per-character dialogue, audio synthesis, and visual storyboards.
  - Live agent status & event inspector.

---

## 🚀 Quick Start (Local)

### 1. Prerequisites
- Python 3.10+
- Anthropic API Key (`sk-ant-...`)
- OpenAI API Key (`sk-...`)

### 2. Installation

Clone the repository and install dependencies:
```bash
git clone https://github.com/godtoe-max/sitcomstudio.git
cd sitcomstudio
pip install -r requirements.txt
```

### 3. Configure Environment

Copy `.env.example` to `.env` and set your API keys:
```bash
cp .env.example .env
```

Edit `.env`:
```env
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
PORT=8000
HOST=127.0.0.1
```

### 4. Run the Studio

```bash
python server.py
```
Open your browser to `http://localhost:8000`.

---

## 🌐 Deploying to Production

### Architecture Overview
SitcomStudio uses a **FastAPI backend with WebSockets** (`/ws/episode`) for real-time bidirectional streaming, paired with a modern vanilla JavaScript frontend in `static/`.

### Option A: Full-Stack on Render / Railway / Fly.io (Recommended)
Because WebSockets require a persistent running server process:
1. Connect this GitHub repository to [Render](https://render.com) or [Railway](https://railway.app).
2. Set the build command: `pip install -r requirements.txt`
3. Set the start command: `uvicorn server:app --host 0.0.0.0 --port $PORT` (or use the included `Procfile`).
4. Add environment variables: `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`.
5. The FastAPI server automatically serves the frontend at the root URL.

### Option B: Frontend on Netlify + Backend on Render/Railway
If deploying the frontend on Netlify:
1. Link this repository in the Netlify dashboard.
2. Netlify will detect `netlify.toml` and deploy the `static/` directory.
3. Deploy the backend to a free/low-cost container service like Render, Railway, or Fly.io.
4. In the Netlify app, connect the frontend to your live backend endpoint.

---

## 🧪 Testing

Run test suites locally:
```bash
python -m unittest test_images.py
python -m unittest test_directing.py
python -m unittest test_speech.py
```

---

## 📄 License
MIT License
