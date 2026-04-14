import { useQuery } from '@tanstack/react-query'
import { apiClient, rowsToObjects } from '../client'
import { STALE_TIME } from '../../config/env'

export function useQueryData<T>(key: string[], sql: string, limit?: number) {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await apiClient.query(sql, limit)
      return rowsToObjects<T>(res.columns, res.rows)
    },
    staleTime: STALE_TIME,
    refetchOnMount: 'always',
    enabled: !!sql,
  })
}

export function useScalarQuery(key: string[], sql: string) {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await apiClient.query(sql, 1)
      if (res.rows.length > 0 && res.rows[0].length > 0) {
        return Number(res.rows[0][0]) || 0
      }
      return 0
    },
    staleTime: STALE_TIME,
    refetchOnMount: 'always',
    enabled: !!sql,
  })
}
