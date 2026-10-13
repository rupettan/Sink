
import type { H3Event } from 'h3'
import type { Compilable } from 'kysely'
import { env as workerEnv } from 'cloudflare:workers'

export function useWAE(event: H3Event, query: Compilable) {
  // Nuxt Runtime Config
  const config = useRuntimeConfig(event)

  // H3 Cloudflare Context
  const cfEnv = event.context.cloudflare?.env

  // Cloudflare Workers Bindings
  const directEnv = workerEnv as unknown as
    Record<string, unknown>

  // 取得可能なBinding名のみ確認
  let bindingNames: string[] = []

  try {
    bindingNames = Object.keys(directEnv)
  }
  catch {
    console.error(
      'Sink Debug: Cannot enumerate bindings',
    )
  }

  // 値の存在確認
  const runtimeAccount = Boolean(config.cfAccountId)
  const runtimeToken = Boolean(config.cfApiToken)

  const contextAccount =
    Boolean(cfEnv?.NUXT_CF_ACCOUNT_ID)

  const contextToken =
    Boolean(cfEnv?.NUXT_CF_API_TOKEN)

  const workerAccount =
    Boolean(directEnv.NUXT_CF_ACCOUNT_ID)

  const workerToken =
    Boolean(directEnv.NUXT_CF_API_TOKEN)

  // 診断ログ（値そのものは記録しない）
  console.error('Sink Environment Check:', {
    runtimeAccount,
    runtimeToken,
    contextAccount,
    contextToken,
    workerAccount,
    workerToken,
  })

  console.error('Available Worker Bindings:', {
    names: bindingNames,
    hasAccountId: Object.prototype.hasOwnProperty.call(
      directEnv,
      'NUXT_CF_ACCOUNT_ID',
    ),
    hasApiToken: Object.prototype.hasOwnProperty.call(
      directEnv,
      'NUXT_CF_API_TOKEN',
    ),
  })

  // 認証情報の取得
  const cfAccountId =
    directEnv.NUXT_CF_ACCOUNT_ID
    || cfEnv?.NUXT_CF_ACCOUNT_ID
    || config.cfAccountId

  const cfApiToken =
    directEnv.NUXT_CF_API_TOKEN
    || cfEnv?.NUXT_CF_API_TOKEN
    || config.cfApiToken

  // 値の形式を確認
  if (
    typeof cfAccountId !== 'string'
    || typeof cfApiToken !== 'string'
    || !cfAccountId.trim()
    || !cfApiToken.trim()
  ) {
    console.error(
      'Sink Analytics: Missing runtime credentials',
    )

    return { data: [] }
  }

  console.error(
    'Sink Analytics: Credentials available',
  )

  // Analytics Engine SQL
  const compiledQuery = compileAnalyticsQuery(query)

  if (import.meta.dev) {
    console.info('useWAE', compiledQuery)
  }

  // Cloudflare Analytics Engine API
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
