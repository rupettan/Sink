import type { H3Event } from 'h3'
import type { Compilable } from 'kysely'

export function useWAE(event: H3Event, query: Compilable) {
  const config = useRuntimeConfig(event)

  // Cloudflare Workersの実行時環境変数を直接取得
  const cfEnv = event.context.cloudflare?.env

  const cfAccountId =
    cfEnv?.NUXT_CF_ACCOUNT_ID || config.cfAccountId

  const cfApiToken =
    cfEnv?.NUXT_CF_API_TOKEN || config.cfApiToken

  if (!cfAccountId || !cfApiToken) {
    console.error('Sink Analytics: Missing runtime credentials')
    return { data: [] }
  }

  const compiledQuery = compileAnalyticsQuery(query)

  if (import.meta.dev)
    console.info('useWAE', compiledQuery)

  return $fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfApiToken}`,
      },
      body: compiledQuery,
      retry: 1,
      retryDelay: 100,
    },
  )
}
