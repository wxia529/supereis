import { useMemo, useState } from 'react'
import { Layer, Rect, Stage, Text } from 'react-konva'

import { useCircuit } from '../hooks/useCircuit'

type ElementType = 'R' | 'C' | 'L' | 'CPE' | 'W'

interface CircuitElement {
  id: string
  type: ElementType
  x: number
  y: number
}

const ELEMENT_TYPES: ElementType[] = ['R', 'C', 'L', 'CPE', 'W']

function buildFormula(elements: CircuitElement[]): string {
  return elements.map((element) => element.id).join('-')
}

export default function CircuitEditor() {
  const [elements, setElements] = useState<CircuitElement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { formula, setFormula, parseCircuit, loading, error, parameters } = useCircuit('')

  const generatedFormula = useMemo(() => buildFormula(elements), [elements])

  const addElement = (type: ElementType) => {
    const count = elements.filter((element) => element.type === type).length + 1
    const newElement: CircuitElement = {
      id: `${type}${count}`,
      type,
      x: 40 + (elements.length % 8) * 85,
      y: 70 + Math.floor(elements.length / 8) * 70,
    }

    setElements((previous) => [...previous, newElement])
    setSelectedId(newElement.id)
  }

  const removeSelected = () => {
    if (!selectedId) {
      return
    }

    setElements((previous) => previous.filter((element) => element.id !== selectedId))
    setSelectedId(null)
  }

  const updateElementPosition = (id: string, x: number, y: number) => {
    setElements((previous) =>
      previous.map((element) =>
        element.id === id
          ? {
              ...element,
              x,
              y,
            }
          : element
      )
    )
  }

  const generateAndParse = async () => {
    const nextFormula = buildFormula(elements)
    setFormula(nextFormula)
    await parseCircuit(nextFormula)
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/80 p-4 text-slate-100">
      <div className="flex flex-wrap gap-2">
        {ELEMENT_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className="rounded bg-indigo-600 px-3 py-1 text-sm font-semibold hover:bg-indigo-500"
            onClick={() => addElement(type)}
          >
            Add {type}
          </button>
        ))}
        <button
          type="button"
          className="rounded bg-rose-600 px-3 py-1 text-sm font-semibold hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!selectedId}
          onClick={removeSelected}
        >
          Remove Selected
        </button>
      </div>

      <div className="overflow-hidden rounded border border-slate-700 bg-slate-950">
        <Stage width={720} height={380} onMouseDown={(event) => event.target === event.target.getStage() && setSelectedId(null)}>
          <Layer>
            {elements.map((element) => (
              <Rect
                key={element.id}
                x={element.x}
                y={element.y}
                width={68}
                height={38}
                cornerRadius={6}
                fill={selectedId === element.id ? '#7c3aed' : '#1e293b'}
                stroke="#cbd5e1"
                strokeWidth={1.5}
                draggable
                onClick={() => setSelectedId(element.id)}
                onTap={() => setSelectedId(element.id)}
                onDragStart={() => setSelectedId(element.id)}
                onDragEnd={(event) => updateElementPosition(element.id, event.target.x(), event.target.y())}
              />
            ))}
            {elements.map((element) => (
              <Text
                key={`${element.id}-label`}
                x={element.x}
                y={element.y + 11}
                width={68}
                align="center"
                text={element.id}
                fill="#e2e8f0"
                fontSize={14}
                fontStyle="bold"
                listening={false}
              />
            ))}
          </Layer>
        </Stage>
      </div>

      <div className="space-y-2 text-sm">
        <div className="rounded bg-slate-800 px-3 py-2">
          <span className="font-semibold">Generated formula:</span>{' '}
          <span className="font-mono">{generatedFormula || '(empty)'}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded bg-emerald-600 px-3 py-1 font-semibold hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => void generateAndParse()}
            disabled={elements.length === 0 || loading}
          >
            {loading ? 'Parsing...' : 'Generate & Parse'}
          </button>
        </div>
        <div className="rounded bg-slate-800 px-3 py-2">
          <span className="font-semibold">Hook formula:</span>{' '}
          <span className="font-mono">{formula || '(empty)'}</span>
        </div>
        {error ? <p className="text-rose-300">{error}</p> : null}
        <p className="text-slate-300">Parsed parameters: {parameters.length}</p>
      </div>
    </div>
  )
}
