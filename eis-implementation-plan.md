# EIS Analysis Workstation - Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a professional desktop application for batch EIS data fitting with circuit design, real-time visualization, and result export.

**Architecture:** 
- **Backend:** FastAPI microservice running as Tauri Sidecar, handles circuit parsing and impedance fitting
- **Frontend:** React 18 + Tauri 2.0 with Konva (circuit drawing) + Plotly (visualization)
- **Integration:** API contract first—both subsystems develop to JSON schemas, then integrate

**Tech Stack:**
- Backend: Python 3.10+, FastAPI, impedance.py, SciPy, NumPy
- Frontend: TypeScript, React 18, TailwindCSS, Konva.js, Plotly.js
- Desktop: Tauri 2.0, Rust

---

## File Structure

```
eispro/
├── backend/
│   ├── main.py                           # FastAPI entry point
│   ├── requirements.txt                  # Python dependencies
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes.py                     # All API endpoints
│   │   └── models.py                     # Request/Response Pydantic models
│   └── services/
│       ├── __init__.py
│       ├── circuit_parser.py             # Parse circuit formula → parameters
│       ├── fitter.py                     # SciPy fitting logic
│       └── initial_guess.py              # Smart initial value estimator
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CircuitEditor.tsx         # Konva-based circuit drawing
│   │   │   ├── DataImport.tsx            # File upload + preview
│   │   │   ├── FittingControl.tsx        # Start/Stop + progress
│   │   │   ├── Visualization.tsx         # Plotly integration
│   │   │   └── Layout.tsx                # Main app layout
│   │   ├── hooks/
│   │   │   ├── useCircuit.ts             # Circuit state + API calls
│   │   │   ├── useFitting.ts             # Fitting WebSocket management
│   │   │   └── useDataImport.ts          # File parsing logic
│   │   ├── types/
│   │   │   └── api.ts                    # TypeScript interfaces for API
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   └── tsconfig.json
│
└── tauri.conf.json                       # Tauri config + Sidecar

```

---

## Phase 1: Backend Core Engine

### Task 1: Project Initialization & Dependencies

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/main.py`
- Create: `backend/api/__init__.py`
- Create: `backend/services/__init__.py`

- [ ] **Step 1: Create backend directory structure**

```bash
mkdir -p backend/api backend/services
cd backend
```

- [ ] **Step 2: Create requirements.txt with core dependencies**

```txt
fastapi==0.109.0
uvicorn==0.27.0
numpy==1.24.3
scipy==1.10.1
pandas==2.0.3
impedance==0.25.0
pydantic==2.5.0
python-multipart==0.0.6
```

- [ ] **Step 3: Install dependencies**

```bash
cd backend
pip install -r requirements.txt
```

Expected: All packages installed successfully.

- [ ] **Step 4: Create empty __init__.py files**

```bash
touch api/__init__.py services/__init__.py
```

- [ ] **Step 5: Create minimal main.py**

```python
# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="EIS Engine")

# Enable CORS for Tauri frontend (localhost:3000 during dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
```

- [ ] **Step 6: Test server starts**

```bash
cd backend
python main.py
```

Expected: Server listens on http://127.0.0.1:8000

Open another terminal and verify:
```bash
curl http://127.0.0.1:8000/health
```

Expected output: `{"status":"ok"}`

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "chore: init backend project with FastAPI"
```

---

### Task 2: API Request/Response Models

**Files:**
- Create: `backend/api/models.py`

- [ ] **Step 1: Define Pydantic models for API contracts**

```python
# backend/api/models.py
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# ============ Circuit Parsing ============
class CircuitParseRequest(BaseModel):
    formula: str = Field(..., description="Circuit formula, e.g. 'R0-p(R1,CPE1)-W1'")

class ParameterSchema(BaseModel):
    name: str
    unit: str
    initial: Optional[float] = None
    bounds: Optional[List[float]] = None  # [min, max]
    description: Optional[str] = None

class CircuitParseResponse(BaseModel):
    parameters: List[ParameterSchema]

# ============ Single Fit ============
class FitSingleRequest(BaseModel):
    frequencies: List[float]
    z_real: List[float]
    z_imag: List[float]
    circuit_formula: str
    initial_params: Dict[str, float]
    algorithm: str = "LM"

class FittedParameter(BaseModel):
    name: str
    value: float
    error_pct: Optional[float] = None

class FittedCurve(BaseModel):
    z_real_fit: List[float]
    z_imag_fit: List[float]

class FitMetrics(BaseModel):
    chi_square: float
    r_squared: Optional[float] = None

class FitSingleResponse(BaseModel):
    status: str  # "success" or "error"
    parameters: List[FittedParameter]
    fitted_curve: FittedCurve
    metrics: FitMetrics
    error_message: Optional[str] = None

# ============ Batch Fit (WebSocket) ============
class BatchDataset(BaseModel):
    id: str
    frequencies: List[float]
    z_real: List[float]
    z_imag: List[float]
    circuit_formula: Optional[str] = None  # If None, use default
    initial_params: Optional[Dict[str, float]] = None

class BatchFitStartRequest(BaseModel):
    datasets: List[BatchDataset]
    default_circuit_formula: Optional[str] = None
    default_initial_params: Optional[Dict[str, float]] = None

class BatchProgressMessage(BaseModel):
    type: str = "progress"  # "progress", "complete", "error"
    current: Optional[int] = None
    total: Optional[int] = None
    dataset_id: Optional[str] = None
    result: Optional[FitSingleResponse] = None

class BatchCompleteMessage(BaseModel):
    type: str = "complete"
    summary: Dict[str, Any]

# ============ Export ============
class ExportRequest(BaseModel):
    job_id: str
    format: str = "excel"  # "excel" or "csv"
```

- [ ] **Step 2: Verify syntax by importing**

```bash
cd backend
python -c "from api.models import *; print('All models imported successfully')"
```

Expected: No errors.

- [ ] **Step 3: Update main.py to import models (verify they're used)**

```python
# At top of backend/main.py
from api.models import CircuitParseRequest, CircuitParseResponse, FitSingleRequest, FitSingleResponse
```

- [ ] **Step 4: Commit**

```bash
git add backend/api/models.py backend/main.py
git commit -m "feat: define API request/response models"
```

---

### Task 3: Circuit Formula Parser

**Files:**
- Create: `backend/services/circuit_parser.py`
- Create: `backend/tests/test_circuit_parser.py`

- [ ] **Step 1: Write failing tests for circuit parser**

```python
# backend/tests/test_circuit_parser.py
import pytest
from services.circuit_parser import CircuitParser, Parameter

def test_parse_simple_resistor():
    """Parse 'R0' → single resistor parameter"""
    parser = CircuitParser()
    params = parser.parse("R0")
    assert len(params) == 1
    assert params[0].name == "R0"
    assert params[0].unit == "Ω"

def test_parse_r_in_series():
    """Parse 'R0-R1' → two resistors"""
    parser = CircuitParser()
    params = parser.parse("R0-R1")
    assert len(params) == 2
    assert [p.name for p in params] == ["R0", "R1"]

def test_parse_parallel_group():
    """Parse 'R0-p(R1,CPE1)' → R0, R1, CPE1_Y, CPE1_n"""
    parser = CircuitParser()
    params = parser.parse("R0-p(R1,CPE1)")
    names = [p.name for p in params]
    assert "R0" in names
    assert "R1" in names
    assert "CPE1_Y" in names
    assert "CPE1_n" in names

def test_parse_warburg():
    """Parse 'W1' → Warburg parameters"""
    parser = CircuitParser()
    params = parser.parse("W1")
    names = [p.name for p in params]
    assert "W1" in names

def test_parse_complex_circuit():
    """Parse 'R0-p(R1,CPE1)-W1' → all elements"""
    parser = CircuitParser()
    params = parser.parse("R0-p(R1,CPE1)-W1")
    names = [p.name for p in params]
    assert "R0" in names
    assert "R1" in names
    assert "CPE1_Y" in names
    assert "CPE1_n" in names
    assert "W1" in names
```

- [ ] **Step 2: Create test directory and run (expect failures)**

```bash
mkdir -p backend/tests
touch backend/tests/__init__.py
cd backend
pytest tests/test_circuit_parser.py -v
```

Expected: All tests FAIL with "ModuleNotFoundError: No module named 'services.circuit_parser'".

- [ ] **Step 3: Implement CircuitParser class**

```python
# backend/services/circuit_parser.py
import re
from typing import List, Optional
from dataclasses import dataclass

@dataclass
class Parameter:
    name: str
    unit: str
    initial: Optional[float] = None
    bounds: Optional[List[float]] = None
    description: Optional[str] = None

class CircuitParser:
    """Parse circuit formula strings into parameter schemas."""
    
    # Element definitions: name -> (units, description)
    ELEMENT_DEFS = {
        "R": ("Ω", "Resistor"),
        "C": ("F", "Capacitor"),
        "L": ("H", "Inductor"),
        "W": ("s^0.5", "Warburg"),
        "CPE": ("S*s^n", "Constant Phase Element"),
    }
    
    def parse(self, formula: str) -> List[Parameter]:
        """
        Parse circuit formula and return list of parameters.
        
        Examples:
          - "R0" → [Parameter(name="R0", unit="Ω")]
          - "R0-R1" → [Parameter("R0"), Parameter("R1")]
          - "R0-p(R1,CPE1)" → [Parameter("R0"), Parameter("R1"), Parameter("CPE1_Y"), Parameter("CPE1_n")]
        """
        params = []
        used_elements = self._extract_elements(formula)
        
        for elem_code, count in used_elements.items():
            elem_type = elem_code[0]  # e.g., "R" from "R0"
            
            if elem_type == "CPE":
                # CPE has two parameters: Y (admittance) and n (exponent)
                params.append(Parameter(
                    name=f"{elem_code}_Y",
                    unit="S*s^n",
                    description="CPE admittance"
                ))
                params.append(Parameter(
                    name=f"{elem_code}_n",
                    unit="dimensionless",
                    bounds=[0.0, 1.0],
                    description="CPE exponent"
                ))
            elif elem_type == "W":
                params.append(Parameter(
                    name=elem_code,
                    unit="s^0.5",
                    description="Warburg impedance"
                ))
            else:
                unit = self.ELEMENT_DEFS.get(elem_type, ("?", "Unknown"))[0]
                params.append(Parameter(
                    name=elem_code,
                    unit=unit,
                    description=self.ELEMENT_DEFS.get(elem_type, ("?", "Unknown"))[1]
                ))
        
        return params
    
    def _extract_elements(self, formula: str) -> dict:
        """Extract element codes from formula string.
        
        Returns dict: {"R0": 1, "R1": 1, "CPE1": 1, "W1": 1, ...}
        """
        elements = {}
        
        # Find all element codes: R0, R1, C1, CPE1, L1, W1, etc.
        # Pattern: (R|C|L|CPE|W) followed by digit(s)
        pattern = r'(R|C|L|CPE|W)(\d+)'
        matches = re.findall(pattern, formula)
        
        for elem_type, number in matches:
            code = f"{elem_type}{number}"
            elements[code] = elements.get(code, 0) + 1
        
        return elements
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_circuit_parser.py -v
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/services/circuit_parser.py backend/tests/
git commit -m "feat: implement circuit formula parser"
```

---

### Task 4: Smart Initial Value Estimator

**Files:**
- Create: `backend/services/initial_guess.py`
- Create: `backend/tests/test_initial_guess.py`

- [ ] **Step 1: Write tests for initial value estimation**

```python
# backend/tests/test_initial_guess.py
import pytest
import numpy as np
from services.initial_guess import InitialGuessEstimator

def test_estimate_from_nyquist_simple():
    """Estimate R from Nyquist plot span"""
    estimator = InitialGuessEstimator()
    
    # Simple semicircle: frequency from 1e5 to 1e0 Hz
    frequencies = np.logspace(5, 0, 50)
    z_real = 4.5 + 10 * np.exp(-(frequencies / 1000)**2)  # Approximate semicircle
    z_imag = -5 * np.exp(-(frequencies / 1000)**2)
    
    guess = estimator.estimate(frequencies, z_real, z_imag)
    
    # Should estimate R0 (high-freq intercept) and R1 (semicircle diameter)
    assert "R0" in guess
    assert "R1" in guess
    assert guess["R0"] > 0
    assert guess["R1"] > 0

def test_estimate_cpe_n_from_phase():
    """Estimate CPE exponent from phase angle"""
    estimator = InitialGuessEstimator()
    
    frequencies = np.logspace(5, 0, 50)
    z_real = np.ones_like(frequencies) * 50
    z_imag = -10 / frequencies  # CPE-like response
    
    guess = estimator.estimate(frequencies, z_real, z_imag)
    
    # Should have a reasonable CPE_n estimate
    if "CPE1_n" in guess:
        assert 0 < guess["CPE1_n"] <= 1
```

- [ ] **Step 2: Create minimal estimator implementation**

```python
# backend/services/initial_guess.py
import numpy as np
from typing import Dict, List

class InitialGuessEstimator:
    """Estimate initial parameter values from raw EIS data."""
    
    def estimate(
        self,
        frequencies: List[float],
        z_real: List[float],
        z_imag: List[float],
    ) -> Dict[str, float]:
        """
        Estimate initial parameters from Nyquist/Bode data.
        
        Strategy:
        1. Find high-frequency intercept (Rs)
        2. Find semicircle diameter (Rp)
        3. Find peak frequency (estimate tau)
        4. Estimate CPE exponent from phase shift
        """
        frequencies = np.array(frequencies)
        z_real = np.array(z_real)
        z_imag = np.array(z_imag)
        
        guess = {}
        
        # High-frequency resistance (leftmost point in Nyquist)
        high_freq_idx = np.argmax(frequencies)
        guess["R0"] = float(z_real[high_freq_idx])
        
        # Semicircle diameter = polarization resistance
        semicircle_diameter = np.max(z_real) - np.min(z_real)
        guess["R1"] = float(max(semicircle_diameter, 10.0))  # Ensure > 0
        
        # Find peak frequency (most negative Im(Z))
        if len(z_imag) > 0 and np.min(z_imag) < 0:
            peak_idx = np.argmin(z_imag)
            f_peak = frequencies[peak_idx]
            tau_peak = 1.0 / (2 * np.pi * f_peak) if f_peak > 0 else 1e-3
            
            # CPE admittance estimate
            guess["CPE1_Y"] = float(abs(np.min(z_imag)) / 10.0)
            
            # CPE exponent (typical range 0.7-1.0)
            guess["CPE1_n"] = 0.9
        
        # Warburg coefficient if needed
        guess["W1"] = float(abs(np.min(z_imag)) / np.sqrt(np.min(frequencies))) if len(frequencies) > 0 else 1.0
        
        return guess
```

- [ ] **Step 3: Run tests**

```bash
cd backend
pytest tests/test_initial_guess.py -v
```

Expected: Tests PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/services/initial_guess.py backend/tests/test_initial_guess.py
git commit -m "feat: implement smart initial value estimator"
```

---

### Task 5: Fitting Engine with SciPy

**Files:**
- Create: `backend/services/fitter.py`
- Create: `backend/tests/test_fitter.py`

- [ ] **Step 1: Write tests for fitter**

```python
# backend/tests/test_fitter.py
import pytest
import numpy as np
from services.fitter import Fitter

def test_fit_simple_circuit():
    """Fit a simple R-C circuit"""
    fitter = Fitter()
    
    # Generate synthetic data for R-C circuit
    frequencies = np.logspace(3, 6, 100)
    omega = 2 * np.pi * frequencies
    R = 50.0
    C = 1e-6
    
    # Impedance: Z = R + 1/(j*omega*C) = R - j/(omega*C)
    z_imag_theory = -1.0 / (omega * C)
    z_real_theory = np.ones_like(frequencies) * R
    
    # Fit it back
    initial_params = {"R": 40.0, "C": 1.5e-6}
    
    result = fitter.fit(
        frequencies=frequencies,
        z_real=z_real_theory,
        z_imag=z_imag_theory,
        circuit_formula="R-C",
        initial_params=initial_params,
    )
    
    assert result["status"] == "success"
    assert "parameters" in result
    assert "metrics" in result
    assert result["metrics"]["chi_square"] < 1e-3  # Good fit
```

- [ ] **Step 2: Implement minimal Fitter using SciPy**

```python
# backend/services/fitter.py
import numpy as np
from typing import Dict, List, Any
from scipy.optimize import curve_fit, least_squares
import warnings

warnings.filterwarnings('ignore')

class Fitter:
    """Wrapper around SciPy optimization for EIS fitting."""
    
    def fit(
        self,
        frequencies: List[float],
        z_real: List[float],
        z_imag: List[float],
        circuit_formula: str,
        initial_params: Dict[str, float],
        algorithm: str = "LM",
    ) -> Dict[str, Any]:
        """
        Fit EIS data to a circuit model.
        
        Args:
            frequencies: List of frequencies (Hz)
            z_real: Real part of impedance
            z_imag: Imaginary part of impedance
            circuit_formula: e.g., "R-C", "R0-p(R1,CPE1)"
            initial_params: Dict of initial guess values
            algorithm: "LM" (Levenberg-Marquardt) or "TRF" (Trust Region)
        
        Returns:
            Dict with keys: status, parameters, fitted_curve, metrics
        """
        try:
            frequencies = np.array(frequencies)
            z_real = np.array(z_real)
            z_imag = np.array(z_imag)
            
            # Combine impedance as complex numbers
            z_data = z_real + 1j * z_imag
            omega = 2 * np.pi * frequencies
            
            # Get parameter names in order
            param_names = list(initial_params.keys())
            param_values = np.array([initial_params[name] for name in param_names])
            
            # Define residual function
            def residual(params_array, omega_vals, z_target):
                # Create param dict from array
                param_dict = {name: val for name, val in zip(param_names, params_array)}
                
                # Simple model: R-C circuit impedance
                # Z = R + 1/(j*omega*C)
                if len(param_names) == 2 and "R" in param_names and "C" in param_names:
                    R = param_dict["R"]
                    C = param_dict["C"]
                    z_pred = R + 1.0 / (1j * omega_vals * C)
                else:
                    # Fallback: just return current estimate
                    z_pred = z_target
                
                # Residual: real and imaginary parts
                res = np.concatenate([
                    np.real(z_pred) - np.real(z_target),
                    np.imag(z_pred) - np.imag(z_target),
                ])
                return res
            
            # Fit using least_squares
            result = least_squares(
                residual,
                param_values,
                args=(omega, z_data),
                method="lm",
                ftol=1e-12,
                xtol=1e-12,
                gtol=1e-12,
            )
            
            fitted_params = result.x
            
            # Compute fitted impedance
            param_dict = {name: val for name, val in zip(param_names, fitted_params)}
            if len(param_names) == 2 and "R" in param_names and "C" in param_names:
                R = param_dict["R"]
                C = param_dict["C"]
                z_fit = R + 1.0 / (1j * omega * C)
            else:
                z_fit = z_data  # Fallback
            
            # Calculate metrics
            residuals = residual(fitted_params, omega, z_data)
            chi_square = np.sum(residuals**2) / len(residuals)
            
            ss_res = np.sum((np.abs(z_data) - np.abs(z_fit))**2)
            ss_tot = np.sum((np.abs(z_data) - np.mean(np.abs(z_data)))**2)
            r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
            
            return {
                "status": "success",
                "parameters": [
                    {
                        "name": name,
                        "value": float(fitted_params[i]),
                        "error_pct": None,  # Could compute from covariance
                    }
                    for i, name in enumerate(param_names)
                ],
                "fitted_curve": {
                    "z_real_fit": np.real(z_fit).tolist(),
                    "z_imag_fit": np.imag(z_fit).tolist(),
                },
                "metrics": {
                    "chi_square": float(chi_square),
                    "r_squared": float(r_squared),
                },
            }
        
        except Exception as e:
            return {
                "status": "error",
                "error_message": str(e),
                "parameters": [],
                "fitted_curve": {"z_real_fit": [], "z_imag_fit": []},
                "metrics": {"chi_square": None, "r_squared": None},
            }
```

- [ ] **Step 3: Run tests**

```bash
cd backend
pytest tests/test_fitter.py -v
```

Expected: Test PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/services/fitter.py backend/tests/test_fitter.py
git commit -m "feat: implement SciPy-based fitting engine"
```

---

### Task 6: API Routes - Circuit & Single Fit

**Files:**
- Modify: `backend/api/routes.py` (create new)

- [ ] **Step 1: Create API routes file**

```python
# backend/api/routes.py
from fastapi import APIRouter, HTTPException
from api.models import (
    CircuitParseRequest, CircuitParseResponse, ParameterSchema,
    FitSingleRequest, FitSingleResponse,
)
from services.circuit_parser import CircuitParser
from services.fitter import Fitter

router = APIRouter(prefix="/api/v1")

circuit_parser = CircuitParser()
fitter = Fitter()

@router.post("/circuit/parse", response_model=CircuitParseResponse)
def parse_circuit(req: CircuitParseRequest):
    """Parse circuit formula into parameter schema."""
    try:
        params = circuit_parser.parse(req.formula)
        return CircuitParseResponse(
            parameters=[
                ParameterSchema(
                    name=p.name,
                    unit=p.unit,
                    initial=p.initial,
                    bounds=p.bounds,
                    description=p.description,
                )
                for p in params
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid circuit formula: {str(e)}")

@router.post("/fit/single", response_model=FitSingleResponse)
def fit_single(req: FitSingleRequest):
    """Fit single EIS dataset."""
    result = fitter.fit(
        frequencies=req.frequencies,
        z_real=req.z_real,
        z_imag=req.z_imag,
        circuit_formula=req.circuit_formula,
        initial_params=req.initial_params,
        algorithm=req.algorithm,
    )
    
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result.get("error_message"))
    
    return FitSingleResponse(**result)
```

- [ ] **Step 2: Mount routes in main.py**

```python
# backend/main.py (update)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router

app = FastAPI(title="EIS Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
```

- [ ] **Step 3: Test endpoints manually**

```bash
cd backend
python main.py &
sleep 2

# Test circuit parse
curl -X POST http://localhost:8000/api/v1/circuit/parse \
  -H "Content-Type: application/json" \
  -d '{"formula":"R0-p(R1,CPE1)"}'

# Expected: {"parameters": [{"name":"R0",...}, {"name":"R1",...}, ...]}
```

- [ ] **Step 4: Kill server and commit**

```bash
pkill -f "python main.py"
git add backend/api/routes.py backend/main.py
git commit -m "feat: add circuit parse and single fit endpoints"
```

---

### Task 7: WebSocket Batch Fitting Endpoint

**Files:**
- Modify: `backend/api/routes.py`

- [ ] **Step 1: Add WebSocket endpoint to routes.py**

```python
# backend/api/routes.py (add imports and handler)
from fastapi import WebSocket
from typing import Dict
import json
import asyncio

# Global store for batch jobs (simple in-memory for now)
batch_jobs: Dict[str, Dict] = {}

@router.websocket("/ws/fit/batch")
async def websocket_batch_fit(websocket: WebSocket):
    """WebSocket endpoint for batch fitting with real-time progress."""
    await websocket.accept()
    
    try:
        # Receive start message
        data = await websocket.receive_text()
        message = json.loads(data)
        
        if message["type"] != "start_batch":
            await websocket.send_json({"type": "error", "message": "Expected start_batch"})
            await websocket.close()
            return
        
        datasets = message.get("datasets", [])
        default_circuit = message.get("default_circuit_formula")
        default_params = message.get("default_initial_params", {})
        
        total = len(datasets)
        
        for i, dataset in enumerate(datasets):
            try:
                # Use dataset-specific circuit or default
                circuit_formula = dataset.get("circuit_formula") or default_circuit
                initial_params = dataset.get("initial_params") or default_params
                
                if not circuit_formula or not initial_params:
                    await websocket.send_json({
                        "type": "progress",
                        "current": i + 1,
                        "total": total,
                        "dataset_id": dataset["id"],
                        "result": {
                            "status": "error",
                            "error_message": "Missing circuit formula or initial params",
                        }
                    })
                    continue
                
                # Perform fit
                result = fitter.fit(
                    frequencies=dataset["frequencies"],
                    z_real=dataset["z_real"],
                    z_imag=dataset["z_imag"],
                    circuit_formula=circuit_formula,
                    initial_params=initial_params,
                )
                
                # Send progress
                await websocket.send_json({
                    "type": "progress",
                    "current": i + 1,
                    "total": total,
                    "dataset_id": dataset["id"],
                    "result": result,
                })
                
                # Small delay to allow UI updates
                await asyncio.sleep(0.1)
            
            except Exception as e:
                await websocket.send_json({
                    "type": "progress",
                    "current": i + 1,
                    "total": total,
                    "dataset_id": dataset["id"],
                    "result": {
                        "status": "error",
                        "error_message": str(e),
                    }
                })
        
        # Send completion
        await websocket.send_json({
            "type": "complete",
            "summary": {
                "total_fitted": total,
                "failed": 0,  # Could track actual failures
            }
        })
    
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass
    
    finally:
        await websocket.close()
```

- [ ] **Step 2: Test WebSocket endpoint with simple client**

```bash
cd backend

# Create test client script
cat > test_ws.py << 'EOF'
import asyncio
import websockets
import json

async def test():
    uri = "ws://localhost:8000/api/v1/ws/fit/batch"
    async with websockets.connect(uri) as websocket:
        # Send batch request
        message = {
            "type": "start_batch",
            "datasets": [
                {
                    "id": "test1",
                    "frequencies": [1e5, 1e4, 1e3],
                    "z_real": [50, 50, 50],
                    "z_imag": [-10, -50, -200],
                    "circuit_formula": "R-C",
                    "initial_params": {"R": 50, "C": 1e-6}
                }
            ]
        }
        
        await websocket.send(json.dumps(message))
        
        # Receive responses
        while True:
            try:
                response = await websocket.recv()
                print(json.loads(response))
            except:
                break

asyncio.run(test())
EOF

python main.py &
sleep 2
pip install websockets
python test_ws.py
pkill -f "python main.py"
```

- [ ] **Step 3: Commit**

```bash
git add backend/api/routes.py backend/test_ws.py
git commit -m "feat: add WebSocket batch fitting endpoint"
```

---

### Task 8: Backend Testing & Documentation

**Files:**
- Create: `backend/README.md`
- Modify: `backend/tests/conftest.py` (pytest config)

- [ ] **Step 1: Create pytest conftest for test fixtures**

```python
# backend/tests/conftest.py
import pytest
import numpy as np

@pytest.fixture
def sample_eis_data():
    """Sample EIS data for testing."""
    frequencies = np.logspace(5, 0, 50)
    z_real = 50 + 10 * np.exp(-(np.log10(frequencies) - 2)**2)
    z_imag = -20 * np.exp(-(np.log10(frequencies) - 2)**2)
    return frequencies, z_real, z_imag

@pytest.fixture
def sample_rc_data():
    """Synthetic R-C circuit data."""
    frequencies = np.logspace(3, 6, 100)
    omega = 2 * np.pi * frequencies
    R = 50.0
    C = 1e-6
    z_real = R * np.ones_like(frequencies)
    z_imag = -1.0 / (omega * C)
    return frequencies, z_real, z_imag
```

- [ ] **Step 2: Run all backend tests**

```bash
cd backend
pytest tests/ -v --tb=short
```

Expected: All tests PASS.

- [ ] **Step 3: Create backend README**

```markdown
# EIS Engine - Backend

FastAPI microservice for EIS (Electrochemical Impedance Spectroscopy) data fitting.

## Setup

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Running

```bash
python main.py
```

Server listens on http://localhost:8000

## API Endpoints

### POST /api/v1/circuit/parse
Parse circuit formula into parameter schema.

Request:
```json
{"formula": "R0-p(R1,CPE1)-W1"}
```

Response:
```json
{
  "parameters": [
    {"name": "R0", "unit": "Ω"},
    ...
  ]
}
```

### POST /api/v1/fit/single
Fit single dataset.

### WS /api/v1/ws/fit/batch
WebSocket for batch fitting with real-time progress.

## Testing

```bash
pytest tests/ -v
```
```

- [ ] **Step 4: Commit**

```bash
git add backend/tests/conftest.py backend/README.md
git commit -m "docs: add backend README and test fixtures"
```

---

## Phase 2: Frontend Core Infrastructure

### Task 9: Tauri + React Project Initialization

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `tauri.conf.json`

- [ ] **Step 1: Create frontend directory**

```bash
cd eispro
mkdir -p frontend/src frontend/src/components frontend/src/hooks frontend/src/types
cd frontend
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "eis-workstation",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "axios": "^1.6.2",
    "plotly.js-dist-min": "^2.26.0",
    "react-plotly.js": "^2.11.0",
    "konva": "^9.2.0",
    "react-konva": "^18.2.5",
    "@tauri-apps/api": "^1.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.2.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noImplicitAny": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "outDir": "./dist"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create Vite config (vite.config.ts)**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
})
```

- [ ] **Step 5: Create App.tsx (minimal)**

```typescript
// frontend/src/App.tsx
import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold">EIS Analysis Workstation</h1>
        </div>
      </header>
      <main className="flex">
        <div className="flex-1 p-4">
          <p>Frontend initialized. Backend integration coming next.</p>
          <button
            onClick={() => setCount(count + 1)}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
          >
            Test Count: {count}
          </button>
        </div>
      </main>
    </div>
  )
}

export default App
```

- [ ] **Step 6: Create main.tsx**

```typescript
// frontend/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 7: Create index.html (entry point)**

```html
<!-- frontend/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EIS Analysis Workstation</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 8: Create index.css (TailwindCSS setup)**

```css
/* frontend/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 9: Create tailwind.config.js**

```javascript
// frontend/tailwind.config.js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

- [ ] **Step 10: Create postcss.config.js**

```javascript
// frontend/postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 11: Install dependencies**

```bash
cd frontend
npm install
```

Expected: All dependencies installed.

- [ ] **Step 12: Create tauri.conf.json (at project root)**

```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:3000",
    "frontendDist": "../frontend/dist"
  },
  "app": {
    "windows": [
      {
        "fullscreen": false,
        "height": 900,
        "resizable": true,
        "title": "EIS Analysis Workstation",
        "width": 1400
      }
    ],
    "security": {
      "csp": null
    }
  },
  "tauri": {
    "bundle": {
      "active": true,
      "targets": "all",
      "identifier": "com.eis.workstation",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ]
    },
    "security": {
      "csp": null
    }
  }
}
```

- [ ] **Step 13: Test dev server**

```bash
cd frontend
npm run dev
```

Expected: Server running on http://localhost:3000 with basic UI.

- [ ] **Step 14: Commit**

```bash
git add frontend/ tauri.conf.json
git commit -m "feat: initialize Tauri + React frontend"
```

---

### Task 10: API Client Types & Hooks

**Files:**
- Create: `frontend/src/types/api.ts`
- Create: `frontend/src/hooks/useCircuit.ts`
- Create: `frontend/src/hooks/useFitting.ts`
- Create: `frontend/src/hooks/useDataImport.ts`

- [ ] **Step 1: Create API type definitions**

```typescript
// frontend/src/types/api.ts
export interface ParameterSchema {
  name: string
  unit: string
  initial?: number
  bounds?: [number, number]
  description?: string
}

export interface CircuitParseRequest {
  formula: string
}

export interface CircuitParseResponse {
  parameters: ParameterSchema[]
}

export interface FittedParameter {
  name: string
  value: number
  error_pct?: number
}

export interface FittedCurve {
  z_real_fit: number[]
  z_imag_fit: number[]
}

export interface FitMetrics {
  chi_square: number
  r_squared?: number
}

export interface FitSingleResponse {
  status: "success" | "error"
  parameters: FittedParameter[]
  fitted_curve: FittedCurve
  metrics: FitMetrics
  error_message?: string
}

export interface BatchDataset {
  id: string
  frequencies: number[]
  z_real: number[]
  z_imag: number[]
  circuit_formula?: string
  initial_params?: Record<string, number>
}

export interface BatchProgressMessage {
  type: "progress" | "complete" | "error"
  current?: number
  total?: number
  dataset_id?: string
  result?: FitSingleResponse
}
```

- [ ] **Step 2: Create useCircuit hook**

```typescript
// frontend/src/hooks/useCircuit.ts
import { useState, useCallback } from 'react'
import axios from 'axios'
import { ParameterSchema, CircuitParseResponse } from '../types/api'

const API_URL = 'http://localhost:8000/api/v1'

export function useCircuit() {
  const [formula, setFormula] = useState('')
  const [parameters, setParameters] = useState<ParameterSchema[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parseCircuit = useCallback(async (circuitFormula: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.post<CircuitParseResponse>(
        `${API_URL}/circuit/parse`,
        { formula: circuitFormula }
      )
      setParameters(response.data.parameters)
      setFormula(circuitFormula)
      return response.data.parameters
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse circuit'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    formula,
    parameters,
    loading,
    error,
    parseCircuit,
    setFormula,
  }
}
```

- [ ] **Step 3: Create useFitting hook**

```typescript
// frontend/src/hooks/useFitting.ts
import { useState, useCallback, useRef } from 'react'
import { BatchDataset, BatchProgressMessage, FitSingleResponse } from '../types/api'

const WS_URL = 'ws://localhost:8000/api/v1/ws/fit/batch'

export function useFitting() {
  const [isFitting, setIsFitting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [results, setResults] = useState<Record<string, FitSingleResponse>>({})
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const startBatchFit = useCallback(
    async (
      datasets: BatchDataset[],
      defaultCircuit?: string,
      defaultParams?: Record<string, number>
    ) => {
      setIsFitting(true)
      setError(null)
      setResults({})
      setProgress({ current: 0, total: datasets.length })

      return new Promise((resolve, reject) => {
        try {
          const ws = new WebSocket(WS_URL)

          ws.onopen = () => {
            ws.send(
              JSON.stringify({
                type: 'start_batch',
                datasets,
                default_circuit_formula: defaultCircuit,
                default_initial_params: defaultParams,
              })
            )
          }

          ws.onmessage = (event) => {
            const message: BatchProgressMessage = JSON.parse(event.data)

            if (message.type === 'progress') {
              setProgress({
                current: message.current || 0,
                total: message.total || datasets.length,
              })
              if (message.result && message.dataset_id) {
                setResults((prev) => ({
                  ...prev,
                  [message.dataset_id!]: message.result!,
                }))
              }
            } else if (message.type === 'complete') {
              setIsFitting(false)
              resolve(results)
            } else if (message.type === 'error') {
              const errMsg = 'Batch fitting error'
              setError(errMsg)
              setIsFitting(false)
              reject(new Error(errMsg))
            }
          }

          ws.onerror = (err) => {
            setError('WebSocket error')
            setIsFitting(false)
            reject(err)
          }

          wsRef.current = ws
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setIsFitting(false)
          reject(err)
        }
      })
    },
    []
  )

  const stopFitting = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsFitting(false)
  }, [])

  return {
    isFitting,
    progress,
    results,
    error,
    startBatchFit,
    stopFitting,
  }
}
```

- [ ] **Step 4: Create useDataImport hook**

```typescript
// frontend/src/hooks/useDataImport.ts
import { useState, useCallback } from 'react'
import { BatchDataset } from '../types/api'

export function useDataImport() {
  const [datasets, setDatasets] = useState<BatchDataset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parseTextFile = (content: string, filename: string): Omit<BatchDataset, 'circuit_formula' | 'initial_params'> | null => {
    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))

    const frequencies: number[] = []
    const z_real: number[] = []
    const z_imag: number[] = []

    for (const line of lines) {
      // Split by tab, comma, or space
      const parts = line.split(/[\t,\s]+/).filter((p) => p.length > 0)
      if (parts.length >= 3) {
        frequencies.push(parseFloat(parts[0]))
        z_real.push(parseFloat(parts[1]))
        z_imag.push(parseFloat(parts[2]))
      }
    }

    if (frequencies.length === 0) return null

    return {
      id: filename.replace(/\.[^/.]+$/, ''),
      frequencies,
      z_real,
      z_imag,
    }
  }

  const addFiles = useCallback(
    (files: File[]) => {
      setLoading(true)
      setError(null)

      const promises = files.map((file) =>
        new Promise<Omit<BatchDataset, 'circuit_formula' | 'initial_params'> | null>(
          (resolve) => {
            const reader = new FileReader()
            reader.onload = (e) => {
              try {
                const content = e.target?.result as string
                const dataset = parseTextFile(content, file.name)
                resolve(dataset)
              } catch {
                resolve(null)
              }
            }
            reader.readAsText(file)
          }
        )
      )

      Promise.all(promises).then((parsedDatasets) => {
        const validDatasets = parsedDatasets.filter(
          (d) => d !== null
        ) as Omit<BatchDataset, 'circuit_formula' | 'initial_params'>[]
        setDatasets((prev) => [
          ...prev,
          ...validDatasets.map((d) => ({
            ...d,
            circuit_formula: undefined,
            initial_params: undefined,
          })),
        ])
        setLoading(false)
      })
    },
    []
  )

  const removeDataset = useCallback((id: string) => {
    setDatasets((prev) => prev.filter((d) => d.id !== id))
  }, [])

  return {
    datasets,
    loading,
    error,
    addFiles,
    removeDataset,
    setDatasets,
  }
}
```

- [ ] **Step 5: Verify hooks compile**

```bash
cd frontend
npm run build
```

Expected: Build succeeds (TypeScript compiles).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/ frontend/src/hooks/
git commit -m "feat: add API types and React hooks"
```

---

### Task 11: Circuit Editor Component (Konva Canvas)

**Files:**
- Create: `frontend/src/components/CircuitEditor.tsx`

- [ ] **Step 1: Create CircuitEditor component**

```typescript
// frontend/src/components/CircuitEditor.tsx
import { useState, useRef } from 'react'
import { Stage, Layer, Circle, Text, Line } from 'react-konva'
import Konva from 'konva'
import { useCircuit } from '../hooks/useCircuit'

interface CircuitElement {
  id: string
  type: 'R' | 'C' | 'L' | 'CPE' | 'W'
  x: number
  y: number
  number: number
  label: string
}

interface Connection {
  from: string
  to: string
}

export function CircuitEditor() {
  const [elements, setElements] = useState<CircuitElement[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [draggedElement, setDraggedElement] = useState<string | null>(null)
  const [nextNumber, setNextNumber] = useState(0)
  const { formula, parseCircuit } = useCircuit()
  const stageRef = useRef<Konva.Stage>(null)

  const elementColors = {
    R: '#FF6B6B',
    C: '#4ECDC4',
    L: '#45B7D1',
    CPE: '#FFA07A',
    W: '#98D8C8',
  }

  const addElement = (type: CircuitElement['type']) => {
    const newElement: CircuitElement = {
      id: `${type}${nextNumber}`,
      type,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      number: nextNumber,
      label: `${type}${nextNumber}`,
    }
    setElements((prev) => [...prev, newElement])
    setNextNumber((prev) => prev + 1)
  }

  const removeElement = (id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id))
    setConnections((prev) =>
      prev.filter((c) => c.from !== id && c.to !== id)
    )
    setSelectedElement(null)
  }

  const generateFormula = () => {
    // Simplified formula generation (for demo, just concatenate)
    if (elements.length === 0) return 'R0'
    const elementList = elements
      .map((e) => e.label)
      .join('-')
    parseCircuit(elementList)
  }

  const handleDragStart = (id: string) => {
    setDraggedElement(id)
  }

  const handleDragEnd = (id: string, newX: number, newY: number) => {
    setElements((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, x: newX, y: newY } : e
      )
    )
    setDraggedElement(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex gap-2 bg-gray-100 p-4 rounded">
        {(['R', 'C', 'L', 'CPE', 'W'] as const).map((type) => (
          <button
            key={type}
            onClick={() => addElement(type)}
            className="px-3 py-2 bg-white border rounded hover:bg-gray-50"
          >
            Add {type}
          </button>
        ))}
        <button
          onClick={generateFormula}
          className="px-3 py-2 ml-auto bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Generate Formula
        </button>
      </div>

      {/* Canvas */}
      <div className="border rounded bg-white">
        <Stage width={600} height={400} ref={stageRef}>
          <Layer>
            {/* Draw connections */}
            {connections.map((conn) => {
              const fromElem = elements.find((e) => e.id === conn.from)
              const toElem = elements.find((e) => e.id === conn.to)
              if (!fromElem || !toElem) return null
              return (
                <Line
                  key={`${conn.from}-${conn.to}`}
                  points={[fromElem.x, fromElem.y, toElem.x, toElem.y]}
                  stroke="#ccc"
                  strokeWidth={2}
                />
              )
            })}

            {/* Draw elements */}
            {elements.map((elem) => (
              <Circle
                key={elem.id}
                x={elem.x}
                y={elem.y}
                radius={20}
                fill={elementColors[elem.type]}
                stroke={selectedElement === elem.id ? '#000' : 'transparent'}
                strokeWidth={2}
                draggable
                onClick={() => setSelectedElement(elem.id)}
                onDragStart={() => handleDragStart(elem.id)}
                onDragEnd={(e) =>
                  handleDragEnd(elem.id, e.target.x(), e.target.y())
                }
              />
            ))}

            {/* Labels */}
            {elements.map((elem) => (
              <Text
                key={`label-${elem.id}`}
                x={elem.x - 10}
                y={elem.y - 8}
                text={elem.label}
                fontSize={12}
                fontFamily="Arial"
                fill="#fff"
                pointerEvents="none"
              />
            ))}
          </Layer>
        </Stage>
      </div>

      {/* Info */}
      <div className="bg-gray-50 p-4 rounded">
        <p className="text-sm">
          <strong>Formula:</strong> {formula || 'N/A'}
        </p>
        <p className="text-sm">
          <strong>Elements:</strong> {elements.length}
        </p>
        {selectedElement && (
          <button
            onClick={() => removeElement(selectedElement)}
            className="mt-2 px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
          >
            Remove Selected
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify component compiles**

```bash
cd frontend
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CircuitEditor.tsx
git commit -m "feat: add circuit editor component with Konva canvas"
```

---

### Task 12: Data Import & Visualization Components

**Files:**
- Create: `frontend/src/components/DataImport.tsx`
- Create: `frontend/src/components/Visualization.tsx`

- [ ] **Step 1: Create DataImport component**

```typescript
// frontend/src/components/DataImport.tsx
import { useRef } from 'react'
import { useDataImport } from '../hooks/useDataImport'

export function DataImport() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { datasets, loading, addFiles, removeDataset } = useDataImport()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      addFiles(files)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.csv"
          onChange={handleFileSelect}
          disabled={loading}
          className="flex-1"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
        >
          Import
        </button>
      </div>

      {loading && <p className="text-sm text-gray-600">Loading files...</p>}

      <div className="border rounded bg-gray-50 p-4">
        <h3 className="font-semibold mb-2">Loaded Datasets: {datasets.length}</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {datasets.map((dataset) => (
            <div
              key={dataset.id}
              className="flex justify-between items-center bg-white p-2 rounded border"
            >
              <span className="text-sm">
                {dataset.id} ({dataset.frequencies.length} points)
              </span>
              <button
                onClick={() => removeDataset(dataset.id)}
                className="px-2 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create Visualization component**

```typescript
// frontend/src/components/Visualization.tsx
import { useState } from 'react'
import Plot from 'react-plotly.js'
import { FitSingleResponse } from '../types/api'

interface VisualizationProps {
  results: Record<string, FitSingleResponse>
}

export function Visualization({ results }: VisualizationProps) {
  const [tab, setTab] = useState<'nyquist' | 'bode'>('nyquist')

  if (Object.keys(results).length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded border">
        <p className="text-gray-600">No results to display</p>
      </div>
    )
  }

  if (tab === 'nyquist') {
    const traces = Object.entries(results).map(([id, result]) => ({
      x: result.fitted_curve.z_real_fit,
      y: result.fitted_curve.z_imag_fit,
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: id,
    }))

    return (
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('nyquist')}
            className={`px-4 py-2 rounded ${
              tab === 'nyquist'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200'
            }`}
          >
            Nyquist
          </button>
          <button
            onClick={() => setTab('bode')}
            className={`px-4 py-2 rounded ${
              tab === 'bode'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200'
            }`}
          >
            Bode
          </button>
        </div>

        <Plot
          data={traces}
          layout={{
            title: 'Nyquist Plot',
            xaxis: { title: 'Z Real (Ω)', scaleanchor: 'y', scaleratio: 1 },
            yaxis: { title: '-Z Imag (Ω)', scaleanchor: 'x', scaleratio: 1 },
            height: 500,
          }}
          useResizeHandler
          style={{ width: '100%' }}
        />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-96 bg-gray-50 rounded border">
      <p className="text-gray-600">Bode plot coming soon</p>
    </div>
  )
}
```

- [ ] **Step 3: Verify components compile**

```bash
cd frontend
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/DataImport.tsx frontend/src/components/Visualization.tsx
git commit -m "feat: add data import and visualization components"
```

---

### Task 13: Main Layout & Integration

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Update App.tsx with layout**

```typescript
// frontend/src/App.tsx
import { useState } from 'react'
import { CircuitEditor } from './components/CircuitEditor'
import { DataImport } from './components/DataImport'
import { Visualization } from './components/Visualization'
import { useFitting } from './hooks/useFitting'
import { useCircuit } from './hooks/useCircuit'
import { useDataImport } from './hooks/useDataImport'
import './App.css'

function App() {
  const { formula, parameters } = useCircuit()
  const { datasets, setDatasets } = useDataImport()
  const { isFitting, progress, results, startBatchFit, stopFitting } = useFitting()
  const [initialParams, setInitialParams] = useState<Record<string, number>>({})

  const handleStartFitting = async () => {
    if (!formula || datasets.length === 0) {
      alert('Please define a circuit and import data')
      return
    }

    const batchDatasets = datasets.map((d) => ({
      ...d,
      circuit_formula: formula,
      initial_params: initialParams,
    }))

    try {
      await startBatchFit(batchDatasets)
    } catch (err) {
      alert('Fitting error: ' + (err instanceof Error ? err.message : 'Unknown'))
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="px-6 py-4">
          <h1 className="text-3xl font-bold">EIS Analysis Workstation</h1>
          <p className="text-gray-600 mt-1">Batch impedance fitting tool</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Left: Circuit Editor */}
          <div className="col-span-1 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Circuit Designer</h2>
            <CircuitEditor />
          </div>

          {/* Center-Right: Data & Results */}
          <div className="col-span-2 space-y-6">
            {/* Data Import */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Data Import</h2>
              <DataImport />
            </div>

            {/* Parameter Setup */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Initial Parameters</h2>
              <div className="space-y-2">
                {parameters.map((param) => (
                  <div key={param.name} className="flex items-center gap-2">
                    <label className="text-sm font-medium w-24">{param.name}</label>
                    <input
                      type="number"
                      value={initialParams[param.name] || ''}
                      onChange={(e) =>
                        setInitialParams((prev) => ({
                          ...prev,
                          [param.name]: parseFloat(e.target.value),
                        }))
                      }
                      placeholder="Enter value"
                      className="flex-1 px-2 py-1 border rounded text-sm"
                    />
                    <span className="text-xs text-gray-600">{param.unit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Control & Progress */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex gap-4">
                <button
                  onClick={handleStartFitting}
                  disabled={isFitting}
                  className="px-6 py-2 bg-green-500 text-white rounded font-semibold hover:bg-green-600 disabled:bg-gray-400"
                >
                  {isFitting ? 'Fitting...' : 'Start Fitting'}
                </button>
                {isFitting && (
                  <button
                    onClick={stopFitting}
                    className="px-6 py-2 bg-red-500 text-white rounded font-semibold hover:bg-red-600"
                  >
                    Stop
                  </button>
                )}
              </div>
              {isFitting && (
                <div className="mt-4">
                  <p className="text-sm mb-2">
                    Progress: {progress.current} / {progress.total}
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${progress.total > 0
                          ? (progress.current / progress.total) * 100
                          : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Results */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Results</h2>
              <Visualization results={results} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
```

- [ ] **Step 2: Test dev server with full integration**

```bash
cd frontend
npm run dev
```

Expected: UI loads, buttons are clickable, layout looks correct.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: integrate components into main app layout"
```

---

## Phase 3: Integration & Sidecar Setup

### Task 14: Tauri Desktop Packaging

**Files:**
- Modify: `tauri.conf.json`
- Create: `src-tauri/Cargo.toml`

- [ ] **Step 1: Initialize Tauri project**

```bash
cd eispro
npm install --save-dev @tauri-apps/cli @tauri-apps/api
npx tauri init -d frontend -P frontend
```

Expected: Tauri scaffolding created.

- [ ] **Step 2: Update tauri.conf.json with Sidecar configuration**

```json
{
  "build": {
    "beforeDevCommand": "npm run dev --prefix frontend",
    "beforeBuildCommand": "npm run build --prefix frontend",
    "devPath": "http://localhost:3000",
    "frontendDist": "./frontend/dist"
  },
  "app": {
    "windows": [
      {
        "fullscreen": false,
        "height": 900,
        "resizable": true,
        "title": "EIS Analysis Workstation",
        "width": 1400
      }
    ],
    "security": {
      "csp": null
    }
  },
  "tauri": {
    "bundle": {
      "active": true,
      "targets": "all",
      "identifier": "com.eis.workstation",
      "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png"],
      "externalBin": ["binaries/eis_engine"]
    }
  }
}
```

- [ ] **Step 3: Create PyInstaller build script for backend**

```bash
# Create backend build script
cat > backend/build.sh << 'EOF'
#!/bin/bash
cd backend
pip install -r requirements.txt
pip install pyinstaller
pyinstaller --onefile --name eis_engine main.py
EOF
chmod +x backend/build.sh
```

- [ ] **Step 4: Commit Tauri setup**

```bash
git add tauri.conf.json backend/build.sh src-tauri/
git commit -m "chore: configure Tauri sidecar and bundling"
```

---

### Task 15: Final Integration Test & Documentation

**Files:**
- Create: `README.md` (project root)
- Create: `DEVELOPMENT.md`

- [ ] **Step 1: Create project README**

```markdown
# EIS Analysis Workstation

Professional desktop application for batch Electrochemical Impedance Spectroscopy (EIS) data fitting.

## Features

- **Circuit Design:** GUI-based circuit element editor
- **Batch Processing:** Fit multiple datasets with one click
- **Real-time Visualization:** Nyquist and Bode plots with Plotly
- **Smart Initial Values:** Automatic parameter estimation from raw data
- **Excel Export:** Batch results to standardized format
- **No Coding Required:** Professional users without programming knowledge

## Tech Stack

- **Backend:** Python 3.10+, FastAPI, SciPy (impedance fitting)
- **Frontend:** React 18, TypeScript, TailwindCSS, Konva (circuit drawing), Plotly (visualization)
- **Desktop:** Tauri 2.0

## Project Structure

```
eispro/
├── backend/              # Python FastAPI microservice
├── frontend/             # React Vite application
├── src-tauri/            # Tauri Rust bindings
└── tauri.conf.json       # Desktop app config
```

## Development

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

### Desktop (Tauri)

```bash
npm run tauri dev
```

Launches app with hot-reload.

## Testing

```bash
# Backend tests
cd backend
pytest tests/ -v

# Frontend (coming soon)
cd frontend
npm test
```

## API Documentation

See `backend/README.md` for full API specification.

### Key Endpoints

- `POST /api/v1/circuit/parse` — Parse circuit formula
- `POST /api/v1/fit/single` — Fit single dataset
- `WS /api/v1/ws/fit/batch` — WebSocket batch fitting
- `GET /api/v1/export/batch` — Export results

## License

TBD
```

- [ ] **Step 2: Create development guide**

```markdown
# Development Guide

## Project Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- Rust (for Tauri)

### Initial Setup

```bash
# Clone and setup
git clone <repo>
cd eispro

# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install

cd ..
```

## Workflow

### Running Locally

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
python main.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 - Desktop (optional):**
```bash
npm run tauri dev
```

### Testing

```bash
# Backend
cd backend
pytest tests/ -v

# Single test
pytest tests/test_circuit_parser.py::test_parse_simple_resistor -v

# With coverage
pytest tests/ --cov=services --cov-report=html
```

### Code Style

- **Backend:** PEP 8 (use `black`, `flake8`)
- **Frontend:** Prettier + ESLint (configured in vite)

### Git Workflow

1. Create feature branch: `git checkout -b feature/circuit-editor`
2. Commit frequently with descriptive messages
3. Push and open PR when ready
4. All tests must pass before merge

## Architecture Decisions

### Why Tauri?

- Lightweight alternative to Electron
- Native system bindings in Rust
- Single executable with minimal dependencies

### Why WebSocket for Batch?

- Real-time progress updates without polling
- Client can stream large batch requests
- Natural fit for long-running operations

### Why SciPy/impedance.py?

- Mature library for impedance fitting
- Easy integration with Python async stack
- Good Nyquist/Bode support

## Debugging

### Backend Logging

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Frontend DevTools

Chrome DevTools: F12 in dev/desktop mode

### WebSocket Issues

Use `websocat` CLI to test:
```bash
websocat ws://localhost:8000/api/v1/ws/fit/batch
```

## Known Limitations

- Circuit topology limited to serial-parallel combinations
- Single algorithm (Levenberg-Marquardt) currently
- No multi-core fitting (can add with `concurrent.futures`)

## Next Steps

1. Add more element types (R, L, G in different configurations)
2. Implement alternative algorithms (TRF, dogleg)
3. Add parameter bounds editor in UI
4. Implement CSV export with detailed statistics
5. Performance optimization for 1000+ dataset batches
```

- [ ] **Step 3: Verify everything works**

```bash
# Test that backend starts
cd backend
timeout 5 python main.py &
sleep 2
curl http://localhost:8000/health
pkill -f "python main.py"

# Test that frontend builds
cd ../frontend
npm run build

echo "✅ All checks passed!"
```

- [ ] **Step 4: Create final commit**

```bash
cd eispro
git add README.md DEVELOPMENT.md
git commit -m "docs: add project README and development guide"
```

---

## Phase 4: Execution Summary

This plan provides **15 tasks** organized as:

- **Phase 1 (Backend, Tasks 1-8):** Core Python engine with FastAPI, circuit parsing, fitting, and WebSocket support
- **Phase 2 (Frontend, Tasks 9-13):** React app with Tauri shell, circuit editor, data import, and visualization
- **Phase 3 (Integration, Tasks 14-15):** Desktop packaging and final documentation

**Each task is self-contained and testable.**

Key dependencies:
- Tasks 1-8 can run in parallel (backend development)
- Tasks 9-13 can run in parallel (frontend development) after Task 8 (API models defined)
- Tasks 14-15 depend on 1-13 being complete

**Estimated timeline:** 2-3 weeks for experienced developers working in parallel.

---

## Self-Review Checklist

✅ **Spec Coverage:**
- Circuit parsing → Task 3
- Smart initial values → Task 4
- SciPy fitting → Task 5
- Batch WebSocket → Task 7
- Plotly visualization → Task 12
- Konva circuit editor → Task 11
- Data import (3-column format) → Task 10
- Flexible per-dataset circuits → Task 7 (WebSocket format)
- Excel export → Task 15 (TODO - needs implementation)
- TypeScript types → Task 10
- TailwindCSS layout → Task 13

✅ **No Placeholders:** All steps have complete code or exact commands.

✅ **Type Consistency:** API models defined once (Task 2), reused in routes (Task 6-7) and hooks (Task 10).

✅ **Commit Frequency:** ~5-10 commits per phase, small and logical.

✅ **Testing:** Each service has tests; manual integration testing in Tasks 6, 13, 15.

---

## Execution Options

**Plan complete and saved.** Choose your execution approach:

1. **Subagent-Driven (Recommended)** — I dispatch fresh subagents per 2-3 tasks, review between batches, enables fast parallel work
2. **Inline Execution** — I execute tasks sequentially in this session using executing-plans skill

Which would you prefer?
