import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  BatchCompleteMessage,
  BatchErrorMessage,
  BatchFitMessage,
  BatchFitStartRequest,
  BatchProgressMessage,
  FitSingleResponse,
} from '../types/api'

export interface BatchFitProgress {
  current: number
  total: number
  datasetId?: string
}

export interface UseFittingState {
  progress: BatchFitProgress | null
  results: FitSingleResponse[]
  summary: Record<string, unknown> | null
  error: string | null
  isRunning: boolean
  start: (request: BatchFitStartRequest) => void
  stop: () => void
}

function defaultWebSocketUrl(): string {
  if (typeof window === 'undefined') {
    return 'ws://localhost:8000/api/v1/fitting/batch'
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/v1/fitting/batch`
}

export function useFitting(webSocketUrl = defaultWebSocketUrl()): UseFittingState {
  const socketRef = useRef<WebSocket | null>(null)
  const [progress, setProgress] = useState<BatchFitProgress | null>(null)
  const [results, setResults] = useState<FitSingleResponse[]>([])
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const stop = useCallback(() => {
    const socket = socketRef.current
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close()
    }
    socketRef.current = null
    setIsRunning(false)
  }, [])

  const start = useCallback(
    (request: BatchFitStartRequest) => {
      stop()

      setProgress(null)
      setResults([])
      setSummary(null)
      setError(null)

      const socket = new WebSocket(webSocketUrl)
      socketRef.current = socket

      socket.onopen = () => {
        setIsRunning(true)
        socket.send(JSON.stringify(request))
      }

      socket.onmessage = (event: MessageEvent<string>) => {
        try {
          const message = JSON.parse(event.data) as BatchFitMessage

          if (message.type === 'progress') {
            const progressMessage = message as BatchProgressMessage
            setProgress({
              current: progressMessage.current ?? 0,
              total: progressMessage.total ?? 0,
              datasetId: progressMessage.dataset_id,
            })
            if (progressMessage.result) {
              setResults((previous) => [...previous, progressMessage.result as FitSingleResponse])
            }
            return
          }

          if (message.type === 'complete') {
            const completeMessage = message as BatchCompleteMessage
            setSummary(completeMessage.summary)
            setIsRunning(false)
            socket.close()
            return
          }

          const errorMessage = message as BatchErrorMessage
          setError(errorMessage.message || 'Batch fitting failed.')
          setIsRunning(false)
          socket.close()
        } catch (caughtError) {
          const message = caughtError instanceof Error ? caughtError.message : 'Failed to decode fitting response.'
          setError(message)
          setIsRunning(false)
          socket.close()
        }
      }

      socket.onerror = () => {
        setError('WebSocket error while batch fitting.')
        setIsRunning(false)
      }

      socket.onclose = () => {
        setIsRunning(false)
        if (socketRef.current === socket) {
          socketRef.current = null
        }
      }
    },
    [stop, webSocketUrl]
  )

  useEffect(() => stop, [stop])

  return {
    progress,
    results,
    summary,
    error,
    isRunning,
    start,
    stop,
  }
}
