# Development Guide

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm

## Initial Setup

```bash
git clone <repo>
cd eispro

# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install

cd ..
```

## Running Locally

### Terminal 1 - Backend

```bash
cd backend
source venv/bin/activate
python main.py
```

Server: http://localhost:8000

### Terminal 2 - Frontend

```bash
cd frontend
npm run dev
```

UI: http://localhost:3000

The Vite dev server proxies `/api` requests to the FastAPI backend automatically.

## Testing

```bash
# Backend (all tests)
cd backend
pytest tests/ -v

# Single test file
pytest tests/test_circuit_parser.py -v

# With coverage
pytest tests/ --cov=services --cov-report=html
```

## Architecture

### Backend

- **FastAPI** handles REST and WebSocket endpoints
- **SciPy `least_squares`** performs Levenberg-Marquardt optimization
- **Circuit parser** uses a recursive-descent parser for formula strings
- **Fitter** supports: R0, R0-R1, R0-p(R1,CPE1) circuits

### Frontend

- **React hooks** manage state: `useCircuit`, `useDataImport`, `useFitting`
- **WebSocket** streams batch fitting progress in real-time
- **Plotly.js** renders Nyquist plots with strict 1:1 axis ratio
- **Konva.js** provides drag-and-drop circuit element canvas

### Data Flow

```
User imports .txt/.csv → useDataImport parses 3-column format
User defines circuit → useCircuit calls POST /api/v1/circuit/parse
User clicks "Start Fit" → useFitting opens WebSocket to /api/v1/ws/fit/batch
Backend fits each dataset → pushes progress messages
Frontend updates results array → Visualization re-renders Plotly charts
```

## Circuit Formula Syntax

| Symbol | Meaning |
|--------|---------|
| `-` | Series connection |
| `p(...)` | Parallel group |
| `R0`, `R1` | Resistors |
| `CPE1` | Constant Phase Element |
| `W1` | Warburg impedance |

Examples:
- `R0` — simple resistor
- `R0-p(R1,CPE1)` — Randles circuit
- `R0-p(R1,CPE1)-W1` — full diffusion model

## Known Limitations

- Fitter supports only 3 circuit topologies (R0, R0-R1, R0-p(R1,CPE1))
- No Excel export yet (planned)
- No Tauri desktop packaging yet (planned)
- Single-threaded fitting (no parallel batch processing)

## Code Style

- **Backend:** PEP 8, type hints, dataclasses
- **Frontend:** TypeScript strict mode, functional components, no class components
