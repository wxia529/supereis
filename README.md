# EIS Analysis Workstation

Professional desktop application for batch Electrochemical Impedance Spectroscopy (EIS) data fitting.

## Features

- **Circuit Design:** GUI-based circuit element editor with Konva.js canvas
- **Batch Processing:** Fit multiple datasets with one click via WebSocket streaming
- **Real-time Visualization:** Nyquist and Bode plots with Plotly.js (strict 1:1 axis ratio)
- **Smart Initial Values:** Automatic parameter estimation from raw EIS data
- **Data Import:** Support for .txt and .csv files (3-column: frequency, Z_real, Z_imag)
- **No Coding Required:** Professional GUI for researchers without programming knowledge

## Tech Stack

- **Backend:** Python 3.10+, FastAPI, SciPy (Levenberg-Marquardt fitting)
- **Frontend:** React 18, TypeScript, TailwindCSS, Konva.js, Plotly.js
- **Desktop:** Tauri 2.0 (planned)

## Project Structure

```
eispro/
├── backend/              # Python FastAPI microservice
│   ├── api/
│   │   ├── models.py     # Pydantic request/response schemas
│   │   └── routes.py     # REST + WebSocket endpoints
│   ├── services/
│   │   ├── circuit_parser.py    # Formula → parameter schema
│   │   ├── fitter.py            # SciPy fitting engine
│   │   └── initial_guess.py     # Smart initial value estimator
│   ├── tests/
│   └── main.py
├── frontend/             # React Vite application
│   ├── src/
│   │   ├── components/
│   │   │   ├── CircuitEditor.tsx   # Konva circuit canvas
│   │   │   ├── DataImport.tsx      # File import UI
│   │   │   └── Visualization.tsx   # Plotly Nyquist/Bode plots
│   │   ├── hooks/
│   │   │   ├── useCircuit.ts       # Circuit parsing state
│   │   │   ├── useDataImport.ts    # File parsing state
│   │   │   └── useFitting.ts       # WebSocket fitting state
│   │   ├── types/
│   │   │   └── api.ts              # TypeScript API interfaces
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
└── eis-design-spec.md    # Full design specification
```

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

Server: http://localhost:8000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI: http://localhost:3000

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/v1/circuit/parse` | Parse circuit formula → parameters |
| POST | `/api/v1/fit/single` | Fit single EIS dataset |
| WS | `/api/v1/ws/fit/batch` | WebSocket batch fitting with progress |

### Circuit Parse

```bash
curl -X POST http://localhost:8000/api/v1/circuit/parse \
  -H "Content-Type: application/json" \
  -d '{"formula": "R0-p(R1,CPE1)-W1"}'
```

### Single Fit

```bash
curl -X POST http://localhost:8000/api/v1/fit/single \
  -H "Content-Type: application/json" \
  -d '{
    "frequencies": [1e5, 1e4, 1e3],
    "z_real": [5.0, 5.2, 6.0],
    "z_imag": [-0.1, -0.5, -1.0],
    "circuit_formula": "R0",
    "initial_params": {"R0": 5.0}
  }'
```

## Testing

```bash
cd backend
pytest tests/ -v
```

## Supported Circuit Formulas

- `R0` — Single resistor
- `R0-R1` — Two series resistors
- `R0-p(R1,CPE1)` — Randles circuit with CPE
- `R0-p(R1,CPE1)-W1` — Full model with Warburg

## License

TBD
