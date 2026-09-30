// ─── Trip Updates Hook ───────────────────────────────────────────────────────
// Subscribes to real-time trip updates via WebSocket.
// Automatically invalidates TanStack Query cache when trip status changes.

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useWebSocket } from '@/providers/WebSocketProvider'
import { tripKeys } from '@/pages/trips/services/queries'

export function useTripUpdates(tripId?: string) {
  const queryClient = useQueryClient()
  const { subscribe, unsubscribe, on, isConnected } = useWebSocket()

  useEffect(() => {
    if (!tripId || !isConnected) return

    subscribe('trip', tripId)

    const unsubTripMatched = on('trip_matched', () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
      queryClient.invalidateQueries({ queryKey: tripKeys.all })
    })

    const unsubTripStarted = on('trip_started', () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
      queryClient.invalidateQueries({ queryKey: tripKeys.all })
    })

    const unsubTripCompleted = on('trip_completed', () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
      queryClient.invalidateQueries({ queryKey: tripKeys.all })
      queryClient.invalidateQueries({ queryKey: tripKeys.stats() })
    })

    return () => {
      unsubscribe('trip', tripId)
      unsubTripMatched()
      unsubTripStarted()
      unsubTripCompleted()
    }
  }, [tripId, isConnected, subscribe, unsubscribe, on, queryClient])
}
