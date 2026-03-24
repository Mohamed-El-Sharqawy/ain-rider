// ─── WebSocket Hook ──────────────────────────────────────────────────────────
// Manages WebSocket connection for real-time updates.
// Automatically reconnects on disconnect, handles subscriptions.

import { useEffect, useRef, useCallback, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'

type MessageHandler<T = unknown> = (data: T) => void

interface WebSocketMessage {
  type: string
  channel?: string
  id?: string
  data?: unknown
  timestamp?: number
}

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001/ws'
const RECONNECT_DELAY = 3000
const PING_INTERVAL = 30000

export function useWebSocket() {
  const { isAuthenticated, user } = useAuthStore()
  const wsRef = useRef<WebSocket | null>(null)
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map())
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isConnectingRef = useRef(false)
  const connectRef = useRef<() => void>(() => {})
  const [isConnected, setIsConnected] = useState(false)
  const userId = user?.id;
  const connect = useCallback(() => {
    if (!isAuthenticated || isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    isConnectingRef.current = true
    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      console.log('[WebSocket] Connected')
      isConnectingRef.current = false
      wsRef.current = ws
      setIsConnected(true)

      // Auto-subscribe to user channel for notifications
      if (userId) {
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'user', id: userId }))
        console.log(`[WebSocket] Auto-subscribed to user:${userId}`)
      }

      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, PING_INTERVAL)
    }

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage
        
        if (message.type === 'pong') return

        const handlers = handlersRef.current.get(message.type)
        if (handlers) {
          handlers.forEach((handler) => handler(message.data))
        }
      } catch (error) {
        console.error('[WebSocket] Message parse error:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error)
    }

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected')
      isConnectingRef.current = false
      wsRef.current = null
      setIsConnected(false)

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = null
      }

      if (isAuthenticated) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connectRef.current()
        }, RECONNECT_DELAY)
      }
    }
  }, [isAuthenticated, userId])

  // Keep connectRef in sync with latest connect function
  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  const subscribe = useCallback((channel: string, id: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', channel, id }))
      console.log(`[WebSocket] Subscribed to ${channel}:${id}`)
    }
  }, [])

  const unsubscribe = useCallback((channel: string, id: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', channel, id }))
      console.log(`[WebSocket] Unsubscribed from ${channel}:${id}`)
    }
  }, [])

  const on = useCallback((eventType: string, handler: MessageHandler) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set())
    }
    handlersRef.current.get(eventType)!.add(handler)

    return () => {
      const handlers = handlersRef.current.get(eventType)
      if (handlers) {
        handlers.delete(handler)
        if (handlers.size === 0) {
          handlersRef.current.delete(eventType)
        }
      }
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      connect()
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [isAuthenticated, connect])

  return {
    subscribe,
    unsubscribe,
    on,
    isConnected,
    userId,
  }
}
