import { useMemo, useState } from 'react'

// @ts-expect-error react-plotly.js has no bundled types in this workspace.
import Plot from 'react-plotly.js'

import type { BatchDataset, FitSingleResponse } from '../types/api'

interface VisualizationProps {
  result: FitSingleResponse | null
  dataset?: BatchDataset | null
}

type TabKey = 'nyquist' | 'bode'

export default function Visualization({ result, dataset }: VisualizationProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('nyquist')

  const nyquistSeries = useMemo(() => {
    if (!result) {
      return []
    }

    const traces: Array<Record<string, unknown>> = []

    if (dataset && dataset.z_real.length > 0 && dataset.z_imag.length > 0) {
      traces.push({
        type: 'scatter',
        mode: 'markers',
        name: 'Measured',
        x: dataset.z_real,
        y: dataset.z_imag.map((value) => -value),
        marker: { color: '#38bdf8', size: 6 },
      })
    }

    traces.push({
      type: 'scatter',
      mode: 'lines',
      name: 'Fit',
      x: result.fitted_curve.z_real_fit,
      y: result.fitted_curve.z_imag_fit.map((value) => -value),
      line: { color: '#f59e0b', width: 2 },
    })

    return traces
  }, [dataset, result])

  const canRenderBode = Boolean(dataset && dataset.frequencies.length > 0 && result)

  return (
    <section className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/80 p-4 text-slate-100">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Visualization</h2>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            className={`rounded px-3 py-1 font-semibold ${activeTab === 'nyquist' ? 'bg-indigo-600' : 'bg-slate-700'}`}
            onClick={() => setActiveTab('nyquist')}
          >
            Nyquist
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1 font-semibold ${activeTab === 'bode' ? 'bg-indigo-600' : 'bg-slate-700'}`}
            onClick={() => setActiveTab('bode')}
          >
            Bode
          </button>
        </div>
      </div>

      {!result ? (
        <p className="text-sm text-slate-300">No fit result available yet.</p>
      ) : activeTab === 'nyquist' ? (
        <Plot
          data={nyquistSeries}
          layout={{
            autosize: true,
            paper_bgcolor: 'rgba(15, 23, 42, 0)',
            plot_bgcolor: 'rgba(15, 23, 42, 0.8)',
            font: { color: '#e2e8f0' },
            margin: { l: 70, r: 20, t: 20, b: 60 },
            xaxis: {
              title: "Z' (Ω)",
              zeroline: false,
              scaleanchor: 'y',
              scaleratio: 1,
            },
            yaxis: {
              title: "-Z'' (Ω)",
              zeroline: false,
            },
            legend: { orientation: 'h' },
          }}
          config={{ displaylogo: false, responsive: true }}
          style={{ width: '100%', height: '420px' }}
          useResizeHandler
        />
      ) : canRenderBode ? (
        <p className="text-sm text-slate-300">
          Bode plotting is pending full frequency-aligned fit output. Dataset and fit are available for future expansion.
        </p>
      ) : (
        <p className="text-sm text-slate-300">Bode view placeholder: frequency-domain series not fully available.</p>
      )}
    </section>
  )
}
