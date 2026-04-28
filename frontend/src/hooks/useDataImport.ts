import { useCallback, useState } from 'react'

import type { BatchDataset } from '../types/api'

export interface ParsedDataColumns {
  frequencies: number[]
  z_real: number[]
  z_imag: number[]
}

export interface UseDataImportState {
  datasets: BatchDataset[]
  error: string | null
  parseTextData: (rawText: string) => ParsedDataColumns
  addDataset: (
    id: string,
    rawText: string,
    options?: { circuitFormula?: string; initialParams?: Record<string, number> }
  ) => BatchDataset
  removeDataset: (id: string) => void
  clearDatasets: () => void
}

function parseNumericColumns(rawText: string): ParsedDataColumns {
  const frequencies: number[] = []
  const zReal: number[] = []
  const zImag: number[] = []

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    throw new Error('No data found in input.')
  }

  lines.forEach((line, index) => {
    if (line.startsWith('#')) {
      return
    }

    const columns = line.split(/[\t, ]+/).filter((column) => column.length > 0)

    if (columns.length < 3) {
      throw new Error(`Line ${index + 1}: expected at least 3 columns.`)
    }

    const [frequencyText, zRealText, zImagText] = columns
    const frequency = Number.parseFloat(frequencyText)
    const real = Number.parseFloat(zRealText)
    const imag = Number.parseFloat(zImagText)

    if (!Number.isFinite(frequency) || !Number.isFinite(real) || !Number.isFinite(imag)) {
      throw new Error(`Line ${index + 1}: contains non-numeric values.`)
    }

    frequencies.push(frequency)
    zReal.push(real)
    zImag.push(imag)
  })

  if (frequencies.length === 0) {
    throw new Error('No valid 3-column rows were parsed.')
  }

  return {
    frequencies,
    z_real: zReal,
    z_imag: zImag,
  }
}

export function useDataImport(): UseDataImportState {
  const [datasets, setDatasets] = useState<BatchDataset[]>([])
  const [error, setError] = useState<string | null>(null)

  const parseTextData = useCallback((rawText: string): ParsedDataColumns => {
    const parsed = parseNumericColumns(rawText)
    setError(null)
    return parsed
  }, [])

  const addDataset = useCallback(
    (
      id: string,
      rawText: string,
      options?: { circuitFormula?: string; initialParams?: Record<string, number> }
    ): BatchDataset => {
      const parsed = parseNumericColumns(rawText)

      const nextDataset: BatchDataset = {
        id,
        ...parsed,
        circuit_formula: options?.circuitFormula,
        initial_params: options?.initialParams,
      }

      setDatasets((previous) => {
        const filtered = previous.filter((dataset) => dataset.id !== id)
        return [...filtered, nextDataset]
      })
      setError(null)

      return nextDataset
    },
    []
  )

  const removeDataset = useCallback((id: string) => {
    setDatasets((previous) => previous.filter((dataset) => dataset.id !== id))
  }, [])

  const clearDatasets = useCallback(() => {
    setDatasets([])
  }, [])

  return {
    datasets,
    error,
    parseTextData,
    addDataset,
    removeDataset,
    clearDatasets,
  }
}
