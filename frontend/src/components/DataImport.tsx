import { useState } from 'react'

import { useDataImport } from '../hooks/useDataImport'

interface DataImportProps {
  onDatasetsChange?: (datasetIds: string[]) => void
}

function buildDatasetId(fileName: string): string {
  const baseName = fileName.replace(/\.[^/.]+$/, '').trim() || 'dataset'
  const normalized = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const uniqueSuffix = Date.now().toString(36)
  return `${normalized}-${uniqueSuffix}`
}

export default function DataImport({ onDatasetsChange }: DataImportProps) {
  const { datasets, addDataset, removeDataset, error } = useDataImport()
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) {
      return
    }

    setIsLoading(true)
    setLocalError(null)

    try {
      for (const file of Array.from(files)) {
        const rawText = await file.text()
        const dataset = addDataset(buildDatasetId(file.name), rawText)
        onDatasetsChange?.([...datasets.map((item) => item.id), dataset.id])
      }
    } catch (caughtError) {
      setLocalError(caughtError instanceof Error ? caughtError.message : 'Failed to import data file.')
    } finally {
      setIsLoading(false)
      event.target.value = ''
    }
  }

  const handleRemove = (id: string) => {
    removeDataset(id)
    onDatasetsChange?.(datasets.filter((dataset) => dataset.id !== id).map((dataset) => dataset.id))
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/80 p-4 text-slate-100">
      <div>
        <h2 className="text-lg font-semibold">Data Import</h2>
        <p className="text-sm text-slate-300">Load .txt or .csv files with frequency, Zreal, and Zimag columns.</p>
      </div>

      <label className="block cursor-pointer rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700">
        <span className="font-medium">Select files</span>
        <input
          type="file"
          accept=".txt,.csv,text/plain,text/csv"
          multiple
          className="hidden"
          onChange={(event) => void handleFileChange(event)}
          disabled={isLoading}
        />
      </label>

      {error || localError ? <p className="text-sm text-rose-300">{localError ?? error}</p> : null}

      <ul className="space-y-2">
        {datasets.map((dataset) => (
          <li
            key={dataset.id}
            className="flex items-center justify-between rounded border border-slate-700 bg-slate-800 px-3 py-2"
          >
            <div>
              <p className="font-mono text-sm">{dataset.id}</p>
              <p className="text-xs text-slate-300">{dataset.frequencies.length} points</p>
            </div>
            <button
              type="button"
              onClick={() => handleRemove(dataset.id)}
              className="rounded bg-rose-600 px-2 py-1 text-xs font-semibold hover:bg-rose-500"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      {datasets.length === 0 ? <p className="text-sm text-slate-400">No datasets loaded.</p> : null}
    </section>
  )
}
