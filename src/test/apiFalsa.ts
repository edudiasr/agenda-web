import { vi } from 'vitest'

type Resposta = { status?: number; corpo: unknown }
type Rota = (url: URL, init: RequestInit) => Resposta | undefined

/**
 * Substitui o fetch: cada chamada passa pelas rotas na ordem e a primeira que responder vale.
 * Guarda as chamadas pra o teste conferir o que foi pedido.
 */
export function apiFalsa(...rotas: Rota[]) {
  const chamadas: Array<{ metodo: string; caminho: string; corpo?: unknown; auth?: string }> = []
  const fetchFalso = vi.fn(async (entrada: string, init: RequestInit = {}) => {
    const url = new URL(entrada)
    const headers = (init.headers ?? {}) as Record<string, string>
    chamadas.push({
      metodo: init.method ?? 'GET',
      caminho: url.pathname + url.search,
      corpo: init.body ? JSON.parse(String(init.body)) : undefined,
      auth: headers.Authorization,
    })
    for (const rota of rotas) {
      const r = rota(url, init)
      if (r) {
        return new Response(JSON.stringify(r.corpo), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } })
      }
    }
    return new Response(JSON.stringify({ detail: `rota não simulada: ${url.pathname}` }), { status: 500 })
  })
  vi.stubGlobal('fetch', fetchFalso)
  return chamadas
}

export const quando = (metodo: string, caminho: string, resposta: Resposta | (() => Resposta)): Rota =>
  (url, init) => {
    if ((init.method ?? 'GET') === metodo && url.pathname === caminho) {
      return typeof resposta === 'function' ? resposta() : resposta
    }
    return undefined
  }

export const SERVICOS = [
  { id: 1, nome: 'Corte', duracaoMinutos: 30, precoCentavos: 4500 },
  { id: 3, nome: 'Corte e barba', duracaoMinutos: 60, precoCentavos: 7000 },
]
export const PROFISSIONAIS = [{ id: 1, nome: 'Rafael' }, { id: 2, nome: 'Bruno' }]

export function agendamento(extra: Record<string, unknown> = {}) {
  return {
    id: 10, codigo: 'K7M2QX', profissional: 'Rafael', servico: 'Corte', precoCentavos: 4500,
    clienteNome: 'Lobo', clienteTelefone: '47999991234', inicio: '2026-11-17T10:00:00', fim: '2026-11-17T10:30:00',
    status: 'AGENDADO', ...extra,
  }
}
