from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CircuitParseRequest(BaseModel):
    formula: str = Field(..., description="Circuit formula, e.g. 'R0-p(R1,CPE1)-W1'")


class ParameterSchema(BaseModel):
    name: str
    unit: str
    initial: Optional[float] = None
    bounds: Optional[List[float]] = None
    description: Optional[str] = None


class CircuitParseResponse(BaseModel):
    parameters: List[ParameterSchema]


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
    status: str
    parameters: List[FittedParameter]
    fitted_curve: FittedCurve
    metrics: FitMetrics
    error_message: Optional[str] = None


class BatchDataset(BaseModel):
    id: str
    frequencies: List[float]
    z_real: List[float]
    z_imag: List[float]
    circuit_formula: Optional[str] = None
    initial_params: Optional[Dict[str, float]] = None


class BatchFitStartRequest(BaseModel):
    datasets: List[BatchDataset]
    default_circuit_formula: Optional[str] = None
    default_initial_params: Optional[Dict[str, float]] = None


class BatchProgressMessage(BaseModel):
    type: str = "progress"
    current: Optional[int] = None
    total: Optional[int] = None
    dataset_id: Optional[str] = None
    result: Optional[FitSingleResponse] = None


class BatchCompleteMessage(BaseModel):
    type: str = "complete"
    summary: Dict[str, Any]


class ExportRequest(BaseModel):
    job_id: str
    format: str = "excel"
