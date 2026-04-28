export interface CircuitParseRequest {
  formula: string
}

export interface ParameterSchema {
  name: string
  unit: string
  initial?: number
  bounds?: [number, number]
  description?: string
}

export interface CircuitParseResponse {
  parameters: ParameterSchema[]
}

export interface FitSingleRequest {
  frequencies: number[]
  z_real: number[]
  z_imag: number[]
  circuit_formula: string
  initial_params: Record<string, number>
  algorithm?: string
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
  status: string
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

export interface BatchFitStartRequest {
  datasets: BatchDataset[]
  default_circuit_formula?: string
  default_initial_params?: Record<string, number>
}

export interface BatchProgressMessage {
  type: 'progress'
  current?: number
  total?: number
  dataset_id?: string
  result?: FitSingleResponse
}

export interface BatchCompleteMessage {
  type: 'complete'
  summary: Record<string, unknown>
}

export interface BatchErrorMessage {
  type: 'error'
  message: string
  dataset_id?: string
}

export type BatchFitMessage = BatchProgressMessage | BatchCompleteMessage | BatchErrorMessage
