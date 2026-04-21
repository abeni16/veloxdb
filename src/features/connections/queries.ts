import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/data/query-keys'
import { veloxDbRepository } from '@/data/repositories'
import { shouldRetryTransientDbInvoke } from '@/lib/transient-invoke-retry'
import type { ConnectionInput, ConnectionSummary } from '@/data/types'

export function useConnectionsQuery() {
  return useQuery({
    queryKey: queryKeys.connections(),
    queryFn: () => veloxDbRepository.listConnections(),
    staleTime: 30 * 1000,
  })
}

type UseConnectMutationOptions = {
  onSuccess?: (connection: ConnectionSummary, input: ConnectionInput) => void
  onError?: (error: unknown, input: ConnectionInput) => void
}

type ConnectContext = {
  previousConnections?: ConnectionSummary[]
  tempId: string
}

export function useConnectMutation(options: UseConnectMutationOptions = {}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ConnectionInput) => veloxDbRepository.connectDb(input),
    onMutate: (input) => {
      const previousConnections =
        queryClient.getQueryData<ConnectionSummary[]>(queryKeys.connections())

      const tempId = `temp_${Date.now()}`
      const optimistic: ConnectionSummary = {
        id: tempId,
        name: input.name,
        host: input.host,
        port: input.port,
        database: input.database,
        user: input.user,
        connectedAt: new Date().toISOString(),
        sslMode: input.sslMode,
      }

      queryClient.setQueryData<ConnectionSummary[]>(queryKeys.connections(), (current) => {
        const existing = current ?? []
        const filtered = existing.filter(
          (c) =>
            c.id !== tempId &&
            !(
              c.name === input.name &&
              c.host === input.host &&
              c.port === input.port &&
              c.database === input.database &&
              c.user === input.user
            ),
        )
        return [optimistic, ...filtered]
      })

      return { previousConnections, tempId } satisfies ConnectContext
    },
    onError: (error, input, context) => {
      if (context) {
        if (context.previousConnections) {
          queryClient.setQueryData(queryKeys.connections(), context.previousConnections)
        } else {
          queryClient.removeQueries({ queryKey: queryKeys.connections() })
        }
      }
      options.onError?.(error, input)
    },
    onSuccess: (nextConnection, input, context) => {
      queryClient.setQueryData<ConnectionSummary[]>(queryKeys.connections(), (current) => {
        const existing = current ?? []
        const filtered = existing.filter(
          (c) => c.id !== nextConnection.id && c.id !== context?.tempId,
        )
        return [nextConnection, ...filtered]
      })

      // Reconcile with authoritative data from backend.
      void queryClient.invalidateQueries({ queryKey: queryKeys.connections() })

      options.onSuccess?.(nextConnection, input)
    },
  })
}

type UseActivateConnectionMutationOptions = {
  onSuccess?: (connection: ConnectionSummary) => void
  onError?: (error: unknown, connectionId: string) => void
}

export function useActivateConnectionMutation(
  options: UseActivateConnectionMutationOptions = {},
) {
  const queryClient = useQueryClient()

  return useMutation({
    retry: shouldRetryTransientDbInvoke,
    mutationFn: (connectionId: string) =>
      veloxDbRepository.setActiveConnection(connectionId),
    onError: (error, connectionId) => {
      options.onError?.(error, connectionId)
    },
    onSuccess: (nextConnection) => {
      // Keep connections list consistent (e.g. connectedAt/name changes).
      queryClient.setQueryData<ConnectionSummary[]>(queryKeys.connections(), (current) => {
        const existing = current ?? []
        const filtered = existing.filter((c) => c.id !== nextConnection.id)
        return [nextConnection, ...filtered]
      })

      void queryClient.invalidateQueries({ queryKey: queryKeys.connections() })
      options.onSuccess?.(nextConnection)
    },
  })
}

