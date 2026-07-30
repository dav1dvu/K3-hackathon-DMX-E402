# Project architecture

The source code is split into two clear areas:

```text
K3-hackathon-DMX-E402/
|-- frontend/                 # React + Vite browser application
|   |-- index.html
|   |-- public/              # Static assets served by Vite
|   |-- src/
|   |   |-- components/      # UI components
|   |   |-- rag/             # Browser-side RAG and golden tests
|   |   |-- services/        # Backend API client
|   |   |-- styles/          # CSS
|   |   |-- test/            # Frontend test setup and fixtures
|   |   |-- types/           # Frontend types
|   |   |-- App.tsx
|   |   `-- main.tsx
|   |-- vite.config.ts       # Vite and /api proxy to backend:3001
|   `-- tsconfig*.json
|
|-- backend/                  # Express + TypeScript API and server-side AI
|   |-- src/
|   |   |-- llm/             # LLM config, provider, and client
|   |   |-- slides/          # PDF parsing, slide cache, and chat API
|   |   |-- tutor/           # Grounded generation with citations
|   |   |-- app.ts           # Express app and routes
|   |   `-- index.ts         # Entry point; reads .env and opens port 3001
|   `-- tsconfig*.json
|
|-- data/                     # Input PDFs and hackathon data
|   |-- slide/                # Put lesson PDFs here
|   `-- processed/            # Generated cache; not committed
|-- eval/                     # AI evaluation data and scripts
|-- docs/                     # Team technical documentation
|-- tham-khao/                # Hackathon reference material
|-- .env                      # Backend secrets; not committed
|-- .env.example              # LLM and Python configuration template
|-- package.json              # Shared commands for FE and BE
|-- requirements.txt          # Python PDF parsing dependencies
|-- README.md                 # Main instructions and hackathon document
`-- 01-*.md ... 04-*.md       # Brief, guide, template, and rubric
```

## Where should a file go?

| File responsibility | Location |
|---|---|
| React, JSX/TSX, CSS, calls to `fetch('/api/...')` | `frontend/` |
| Express routes, API, API keys, LLM, PDF/Python processing | `backend/` |
| Input PDFs and datasets | `data/` |
| Golden sets and metric scripts | `eval/` |
| Technical documentation | `docs/` |
| Configuration and commands shared by the whole project | repository root |
| Required hackathon documents | repository root |

Do not put `.env` in `frontend/`. Only the backend reads API keys. The frontend calls `/api`, and Vite proxies those requests to `http://127.0.0.1:3001` during development.

## Runtime flow

```text
Browser (frontend:5173)
  -> /api/slides/...
  -> Vite proxy
  -> Express (backend:3001)
  -> read/cache PDFs in data/
  -> call the LLM using secrets from .env
  -> return answer and citations to frontend
```

## Run the project

From the repository root:

```powershell
npm install
Copy-Item .env.example .env
# Set LLM_PRIMARY_API_KEY and LLM_PRIMARY_MODEL in .env
npm run dev
```

`npm run dev` starts frontend and backend together. Use `npm run dev:web` or `npm run dev:server` to start only one side.

## Dependency convention

The project currently uses one root `package.json` to keep installation and demos simple. Do not add separate `package.json` files under `frontend/` or `backend/` until the two applications need independent deployment.