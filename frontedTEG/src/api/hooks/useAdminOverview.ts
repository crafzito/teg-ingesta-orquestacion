import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchAdminOverview, refreshSchemaCache } from '../admin'

const ADMIN_OVERVIEW_KEY = ['admin', 'overview']

export function useAdminOverview() {
  return useQuery({
    queryKey: ADMIN_OVERVIEW_KEY,
    queryFn: fetchAdminOverview,
    staleTime: 60_000,
  })
}

export function useRefreshSchemaCache() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: refreshSchemaCache,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_OVERVIEW_KEY })
    },
  })
}
