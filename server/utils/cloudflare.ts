
import type { H3Event } from 'h3'
import type { Compilable } from 'kysely'
import { env as workerEnv } from 'cloudflare:workers'

export function useWAE(event: H3Event, query: Compilable) {
  // ① Nuxt Runtime Config
  const config = useRuntimeConfig(event)

  // ② H3 Cloudflare Context
  const cfEnv = event.context.cloudflare?.env

  // ③ Cloudflare Workers直接参照
  const directEnv = workerEnv as unknown as Record<string, string | undefined>

  // 環境変数の取得状況を記録
  // 値そのものはログに出力しない
  console.log('Sink Environment Check:', {
    runtimeAccount: Boolean(config.cfAccountId),
    runtimeToken: Boolean(config.cfApiToken),

    contextAccount: Boolean(cfEnv?.NUXT_CF_ACCOUNT_ID),
    contextToken: Boolean(cfEnv?.NUXT_CF_API_TOKEN),

    workerAccount: Boolean(directEnv.NUXT_CF_ACCOUNT_ID),
    workerToken: Boolean(directEnv.NUXT_CF_API_TOKEN),
  })

  // 取得できる環境から認証情報を取得
  const cfAccountId
    = directEnv.NUXT_CF_ACCOUNT_ID
      || cfEnv?.NUXT_CF_ACCOUNT_ID
      || config.cfAccountId

  const cfApiToken
    = directEnv.NUXT_CF_API_TOKEN
      || cfEnv?.NUXT_CF_API_TOKEN
      || config.cfApiToken

  // 認証情報が取得できなければ空データを返す
  if (!cfAccountId || !cfApiToken) {
    console.error(
      'Sink Analytics: Missing runtime credentials',
    )

    return { data: [] }
  }

  // 使用した取得方法をログに記録
  console.log('Sink Analytics Credentials:', {
    source: directEnv.NUXT_CF_ACCOUNT_ID
      ? 'cloudflare:workers'
      : cfEnv?.NUXT_CF_ACCOUNT_ID
        ? 'cloudflare context'
        : 'nuxt runtime config',

    hasAccountId: Boolean(cfAccountId),
    hasApiToken: Boolean(cfApiToken),
  })

  // Analytics Engine用SQL生成
  const compiledQuery = compileAnalyticsQuery(query)

  if (import.meta.dev)
    console.info('useWAE', compiledQuery)

  // Cloudflare Analytics Engine SQL API
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
