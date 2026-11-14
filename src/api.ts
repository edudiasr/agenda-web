// Cliente da Agenda API (Spring Boot). Os tipos espelham os records do back-end.

export interface Servico {
  id: number
  nome: string
  duracaoMinutos: number
  precoCentavos: number
}

export interface Profissional {
  id: number
  nome: string
}

export type Status = 'AGENDADO' | 'CANCELADO' | 'CONCLUIDO' | 'FALTOU'

export interface Agendamento {
  id: number
  codigo: string
  profissional: string
  servico: string
  precoCentavos: number
  clienteNome: string
  clienteTelefone: string
  inicio: string // "2026-11-17T10:00:00", horário local da barbearia
  fim: string
  status: Status
}

export interface NovoAgendamento {
  profissionalId: number
  servicoId: number
  inicio: string
  clienteNome: string
  clienteTelefone: string
}

/** Erro no formato Problem Details que a API devolve. */
export class ErroDaApi extends Error {
  readonly status: number
  readonly campos: Record<string, string>

  constructor(status: number, mensagem: string, campos: Record<string, string> = {}) {
    super(mensagem)
    this.status = status
    this.campos = campos
  }
}

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

/** Avisado quando uma chamada passa de alguns segundos: no plano gratuito o servidor "dorme" e demora pra acordar. */
type OuvinteDeDemora = (demorando: boolean) => void
const ouvintes = new Set<OuvinteDeDemora>()
let emAndamento = 0
let timer: ReturnType<typeof setTimeout> | undefined

export function aoDemorar(fn: OuvinteDeDemora) {
  ouvintes.add(fn)
  return () => {
    ouvintes.delete(fn)
  }
}

function avisar(demorando: boolean) {
  ouvintes.forEach((fn) => fn(demorando))
}

async function chamar<T>(caminho: string, opcoes: RequestInit = {}, token?: string): Promise<T> {
  emAndamento++
  if (emAndamento === 1) timer = setTimeout(() => avisar(true), 4000)
  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (opcoes.body) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`
    let resposta: Response
    try {
      resposta = await fetch(API_URL + caminho, { ...opcoes, headers })
    } catch {
      throw new ErroDaApi(0, 'Não foi possível falar com o servidor. Confira sua conexão e tente de novo.')
    }
    if (!resposta.ok) {
      const corpo = await resposta.json().catch(() => ({}))
      throw new ErroDaApi(resposta.status, corpo.detail ?? `Erro ${resposta.status}`, corpo.campos ?? {})
    }
    return (await resposta.json()) as T
  } finally {
    emAndamento--
    if (emAndamento === 0) {
      clearTimeout(timer)
      avisar(false)
    }
  }
}

export const api = {
  servicos: () => chamar<Servico[]>('/api/servicos'),
  profissionais: () => chamar<Profissional[]>('/api/profissionais'),
  horarios: (profissionalId: number, servicoId: number, data: string) =>
    chamar<{ horarios: string[] }>(`/api/horarios?${new URLSearchParams({
      profissionalId: String(profissionalId), servicoId: String(servicoId), data,
    })}`).then((r) => r.horarios.map((h) => h.slice(0, 5))),
  agendar: (pedido: NovoAgendamento) =>
    chamar<Agendamento>('/api/agendamentos', { method: 'POST', body: JSON.stringify(pedido) }),
  consultar: (codigo: string) => chamar<Agendamento>(`/api/agendamentos/${encodeURIComponent(codigo.trim())}`),
  cancelar: (codigo: string) =>
    chamar<Agendamento>(`/api/agendamentos/${encodeURIComponent(codigo.trim())}/cancelar`, { method: 'POST' }),

  login: (email: string, senha: string) =>
    chamar<{ token: string; expiraEm: string; nome: string }>('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ email, senha }),
    }),
  agendaDoDia: (data: string, token: string) =>
    chamar<Agendamento[]>(`/api/admin/agenda?data=${data}`, {}, token),
  mudarStatus: (id: number, status: Status, token: string) =>
    chamar<Agendamento>(`/api/admin/agendamentos/${id}/status`, {
      method: 'PATCH', body: JSON.stringify({ status }),
    }, token),
}
