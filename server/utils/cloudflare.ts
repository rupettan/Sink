
import type { H3Event } from 'h3'
import type { Compilable } from 'kysely'
import { env as workerEnv } from 'cloudflare:workers'

export function useWAE(event: H3Event, query: Compilable) {
  // Nuxtの実行時設定
  const config = useRuntimeConfig(event)

  // CloudflareのH3 Context
  const cfEnv = event.context.cloudflare?.env

  // Cloudflare Workersの環境変数
  const directEnv = workerEnv as unknown as
    Record<string, unknown>

  // Bindingの名前を取得
  // 値やAPIトークンは出力しない
  let bindingNames: string[] = []

  try {
    bindingNames = Object.keys(directEnv)
  }
  catch {
    console.warn(
      'Sink: Failed to enumerate Worker bindings',
    )
  }

  // 環境変数が存在するか確認
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

  // 診断ログ
  console.log('Sink Environment Check:', {
    runtimeAccount,
    runtimeToken,
    contextAccount,
    contextToken,
    workerAccount,
    workerToken,
  })

  console.log('Available Worker Bindings:', {
    names: bindingNames,
    hasAccountId: Object.hasOwn(
      directEnv,
      'NUXT_CF_ACCOUNT_ID',
    ),
    hasApiToken: Object.hasOwn(
      directEnv,
      'NUXT_CF_API_TOKEN',
    ),
  })

  // 環境変数を優先順位順に取得
  const cfAccountId =
    directEnv.NUXT_CF_ACCOUNT_ID
    || cfEnv?.NUXT_CF_ACCOUNT_ID
    || config.cfAccountId

  const cfApiToken =
    directEnv.NUXT_CF_API_TOKEN
    || cfEnv?.NUXT_CF_API_TOKEN
    || config.cfApiToken

  // 認証情報がない場合
  if (
    typeof cfAccountId !== 'string'
    || typeof cfApiToken !== 'string'
    || !cfAccountId
    || !cfApiToken
  ) {
    console.error(
      'Sink Analytics: Missing runtime credentials',
    )

    return { data: [] }
  }

  // 認証情報の取得成功
  console.log('Sink Analytics: Credentials available')

  // SQLクエリを生成
  const compiledQuery = compileAnalyticsQuery(query)

  if (import.meta.dev) {
    console.info('useWAE', compiledQuery)
  }

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
