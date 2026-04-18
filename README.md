# ArgueNet

Multi-agent debate orchestrator with a small React demo dashboard.

## Prerequisites

- **Python 3.10+** (for the orchestrator API)
- **Node.js 18+** and npm (for the frontend)

## 1. Orchestrator (FastAPI)

Install dependencies:

```bash
cd orchestrator
pip install -r requirements.txt
```

Start the API on port **8000**:

```bash
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

(Use a virtual environment if you prefer: `python -m venv .venv`, then activate it before `pip install`.)

- **Health check:** [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- **OpenAPI docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

Keep this terminal running while you use the UI.

## 2. Frontend (Vite + React)

In a **second** terminal, from the repository root:

```bash
cd frontend
npm install
npm run dev
```

Open the URL shown in the terminal (usually **http://localhost:5173**). The dev server proxies `/debate` and `/health` to `http://127.0.0.1:8000`, so the orchestrator must be running first.

### Optional: point the UI at the API without the proxy

Create `frontend/.env.local`:

```env
VITE_API_BASE=http://127.0.0.1:8000
```

Then restart `npm run dev`. The orchestrator allows browser requests from other origins (CORS is enabled for demos).

### Production build

```bash
cd frontend
npm run build
npm run preview
```

`preview` serves the built app; you still need the orchestrator running (and either the same proxy setup or `VITE_API_BASE` pointing at it).

## Quick checklist

1. `cd orchestrator` → `pip install -r requirements.txt` → `uvicorn app:app --reload --port 8000`
2. `cd frontend` → `npm install` → `npm run dev`
3. Submit a question in the browser and confirm the timeline updates.
