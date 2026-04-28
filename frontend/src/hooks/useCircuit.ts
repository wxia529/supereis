import { useCallback, useState } from 'react'
import axios from 'axios'

import type { CircuitParseRequest, CircuitParseResponse, ParameterSchema } from '../types/api'

export interface UseCircuitState {
  formula: string
  parameters: ParameterSchema[]
  loading: boolean
  error: string | null
  setFormula: (formula: string) => void
  parseCircuit: (formulaOverride?: string) => Promise<ParameterSchema[] | null>
}

export function useCircuit(initialFormula = ''): UseCircuitState {
  const [formula, setFormula] = useState(initialFormula)
  const [parameters, setParameters] = useState<ParameterSchema[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parseCircuit = useCallback(
    async (formulaOverride?: string): Promise<ParameterSchema[] | null> => {
      const nextFormula = (formulaOverride ?? formula).trim()

      if (!nextFormula) {
        setError('Circuit formula is required.')
        setParameters([])
        return null
      }

      if (formulaOverride !== undefined) {
        setFormula(formulaOverride)
      }

      setLoading(true)
      setError(null)

      try {
        const payload: CircuitParseRequest = { formula: nextFormula }
        const response = await axios.post<CircuitParseResponse>('/api/v1/circuit/parse', payload)
        const parsedParameters = response.data.parameters ?? []
        setParameters(parsedParameters)
        return parsedParameters
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Failed to parse circuit formula.'
        setError(message)
        setParameters([])
        return null
      } finally {
        setLoading(false)
      }
    },
    [formula]
  )

  return {
    formula,
    parameters,
    loading,
    error,
    setFormula,
    parseCircuit,
  }
}
