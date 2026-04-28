import { useMemo, useState } from 'react'

import CircuitEditor from './components/CircuitEditor'
import DataImport from './components/DataImport'
import Visualization from './components/Visualization'
import { useCircuit } from './hooks/useCircuit'
import { useDataImport } from './hooks/useDataImport'
import { useFitting } from './hooks/useFitting'
import type { BatchFitStartRequest, BatchDataset } from './types/api'

function buildDatasetId(fileName: string): string {
  const baseName = fileName.replace(/\.[^/.]+$/, '').trim() || 'dataset'
  return `${baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`
}

function App() {
  const [manualFormula, setManualFormula] = useState('')
  const [activeResultIndex, setActiveResultIndex] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)

  const { formula, parameters, parseCircuit, setFormula, loading: parseLoading, error: circuitError } = useCircuit('')
  const { datasets, addDataset, removeDataset, error: importError } = useDataImport()
  const { progress, results, summary, error: fittingError, isRunning, start, stop } = useFitting()

  const activeResult = results[activeResultIndex] ?? null
  const activeDataset = datasets[activeResultIndex] ?? null
  const progressPercent = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  const defaultInitialParams = useMemo(
    () =>
      parameters.reduce<Record<string, number>>((accumulator, item) => {
        if (typeof item.initial === 'number') {
          accumulator[item.name] = item.initial
        }
        return accumulator
      }, {}),
    [parameters]
  )

  const handleImportFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) {
      return
    }

    for (const file of Array.from(files)) {
      const rawText = await file.text()
      addDataset(buildDatasetId(file.name), rawText, { circuitFormula: formula || undefined })
    }

    event.target.value = ''
  }

  const handleParseFormula = async () => {
    const nextFormula = manualFormula.trim()
    setFormula(nextFormula)
    await parseCircuit(nextFormula)
  }

  const handleStartFit = () => {
    const selectedFormula = manualFormula.trim() || formula.trim()

    if (!selectedFormula) {
      setFormError('Enter a circuit formula before fitting.')
      return
    }

    if (datasets.length === 0) {
      setFormError('Import at least one dataset before fitting.')
      return
    }

    const preparedDatasets: BatchDataset[] = datasets.map((dataset) => ({
      ...dataset,
      circuit_formula: dataset.circuit_formula || selectedFormula,
      initial_params: dataset.initial_params || (Object.keys(defaultInitialParams).length > 0 ? defaultInitialParams : undefined),
    }))

    const payload: BatchFitStartRequest = {
      datasets: preparedDatasets,
      default_circuit_formula: selectedFormula,
      default_initial_params: Object.keys(defaultInitialParams).length > 0 ? defaultInitialParams : undefined,
    }

    setFormError(null)
    setActiveResultIndex(0)
    start(payload)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 p-6 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header>
          <h1 className="text-3xl font-bold">EIS Analysis Workstation</h1>
          <p className="text-slate-300">Design circuits, import measured data, run fitting, and inspect results.</p>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
          <section className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/80 p-4">
            <h2 className="text-lg font-semibold">Fitting Workflow</h2>

            <div className="space-y-2 rounded border border-slate-700 bg-slate-800/70 p-3">
              <label htmlFor="fit-formula" className="block text-sm font-semibold">
                Circuit formula
              </label>
              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  id="fit-formula"
                  type="text"
                  value={manualFormula}
                  onChange={(event) => setManualFormula(event.target.value)}
                  placeholder="Example: R1-C1-W1"
                  className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleParseFormula()}
                  disabled={parseLoading}
                  className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40"
                >
                  {parseLoading ? 'Parsing...' : 'Parse'}
                </button>
              </div>
              <p className="text-xs text-slate-300">Parsed parameter count: {parameters.length}</p>
            </div>

            <div className="space-y-2 rounded border border-slate-700 bg-slate-800/70 p-3">
              <label className="block cursor-pointer rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm hover:bg-slate-800">
                <span className="font-semibold">Import datasets (.txt / .csv)</span>
                <input
                  type="file"
                  accept=".txt,.csv,text/plain,text/csv"
                  multiple
                  className="hidden"
                  onChange={(event) => void handleImportFiles(event)}
                />
              </label>
              <ul className="space-y-2">
                {datasets.map((dataset) => (
                  <li key={dataset.id} className="flex items-center justify-between rounded border border-slate-700 bg-slate-900 px-3 py-2">
                    <div>
                      <p className="font-mono text-sm">{dataset.id}</p>
                      <p className="text-xs text-slate-400">{dataset.frequencies.length} points</p>
                    </div>
                    <button
                      type="button"
                      className="rounded bg-rose-600 px-2 py-1 text-xs font-semibold hover:bg-rose-500"
                      onClick={() => removeDataset(dataset.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              {datasets.length === 0 ? <p className="text-sm text-slate-400">No datasets loaded.</p> : null}
            </div>

            <div className="space-y-3 rounded border border-slate-700 bg-slate-800/70 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartFit}
                  disabled={isRunning}
                  className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-40"
                >
                  Start Fit
                </button>
                <button
                  type="button"
                  onClick={stop}
                  disabled={!isRunning}
                  className="rounded bg-rose-600 px-4 py-2 text-sm font-semibold hover:bg-rose-500 disabled:opacity-40"
                >
                  Stop
                </button>
              </div>
              <div className="h-2 overflow-hidden rounded bg-slate-700">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="text-sm text-slate-300">
                Progress:{' '}
                {progress ? `${progress.current}/${progress.total}${progress.datasetId ? ` (${progress.datasetId})` : ''}` : 'Idle'}
              </p>
            </div>

            {formError || circuitError || importError || fittingError ? (
              <p className="rounded border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
                {formError ?? circuitError ?? importError ?? fittingError}
              </p>
            ) : null}
          </section>

          <div className="space-y-4">
            <Visualization result={activeResult} dataset={activeDataset} />
            <section className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/80 p-4">
              <h2 className="text-lg font-semibold">Fit Results</h2>
              <p className="text-sm text-slate-300">Completed fits: {results.length}</p>
              {results.length > 1 ? (
                <select
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
                  value={activeResultIndex}
                  onChange={(event) => setActiveResultIndex(Number(event.target.value))}
                >
                  {results.map((_, index) => (
                    <option key={`result-${index}`} value={index}>
                      Result {index + 1}
                    </option>
                  ))}
                </select>
              ) : null}
              {summary ? <pre className="overflow-auto rounded bg-slate-950 p-3 text-xs">{JSON.stringify(summary, null, 2)}</pre> : null}
            </section>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <CircuitEditor />
          <DataImport />
        </div>
      </div>
    </div>
  )
}

export default App
