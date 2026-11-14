import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, ErroDaApi, type Agendamento, type Status } from '../api'
import { STATUS, iso, preco, telefone } from '../formato'

const CHAVE = 'agenda.token'

// o token fica no sessionStorage: some ao fechar a aba, então um computador compartilhado
// na recepção não fica com o painel aberto pra sempre
function tokenSalvo(): string | null {
  try {
    return sessionStorage.getItem(CHAVE)
  } catch {
    return null
  }
}

export function Admin() {
  const [token, setToken] = useState<string | null>(tokenSalvo)

  const sair = useCallback(() => {
    sessionStorage.removeItem(CHAVE)
    setToken(null)
  }, [])

  if (!token) {
    return <Login aoEntrar={(t) => { sessionStorage.setItem(CHAVE, t); setToken(t) }} />
  }
  return <AgendaDoDia token={token} aoExpirar={sair} />
}

function Login({ aoEntrar }: { aoEntrar: (token: string) => void }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string>()

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro(undefined)
    try {
      aoEntrar((await api.login(email, senha)).token)
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  return (
    <section className="cartao estreito">
      <h2>Área da barbearia</h2>
      <form onSubmit={entrar} className="formulario">
        <label>E-mail <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
        <label>Senha <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required /></label>
        {erro && <p className="alerta" role="alert">{erro}</p>}
        <button className="botao">Entrar</button>
      </form>
    </section>
  )
}

function AgendaDoDia({ token, aoExpirar }: { token: string; aoExpirar: () => void }) {
  const [data, setData] = useState(() => iso(new Date()))
  const [lista, setLista] = useState<Agendamento[]>()
  const [erro, setErro] = useState<string>()

  const tratar = useCallback((e: unknown) => {
    if (e instanceof ErroDaApi && e.status === 401) aoExpirar() // token venceu: volta pro login
    else setErro((e as Error).message)
  }, [aoExpirar])

  useEffect(() => {
    let valido = true
    api.agendaDoDia(data, token).then((l) => valido && setLista(l), tratar)
    return () => {
      valido = false
    }
  }, [data, token, tratar])

  async function mudar(a: Agendamento, status: Status) {
    try {
      const novo = await api.mudarStatus(a.id, status, token)
      setLista((l) => l?.map((x) => (x.id === a.id ? novo : x)))
    } catch (e) {
      tratar(e)
    }
  }

  const ativos = lista?.filter((a) => a.status !== 'CANCELADO') ?? []
  const previsto = ativos.reduce((t, a) => t + a.precoCentavos, 0)

  return (
    <section className="cartao">
      <header className="cabecalho-agenda">
        <h2>Agenda do dia</h2>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} aria-label="Dia" />
        <button className="botao secundario" onClick={aoExpirar}>Sair</button>
      </header>
      {erro && <p className="alerta" role="alert">{erro}</p>}
      {lista && (
        <p className="suave">{ativos.length} atendimento(s) · previsto {preco(previsto)}</p>
      )}
      {lista?.length === 0 && <p className="suave">Nenhum horário marcado nesse dia.</p>}
      {lista && lista.length > 0 && (
        <ul className="agenda">
          {lista.map((a) => (
            <li key={a.id} className={a.status.toLowerCase()}>
              <time>{a.inicio.slice(11, 16)}</time>
              <div>
                <strong>{a.clienteNome}</strong> · {a.servico} com {a.profissional}
                <div className="suave">
                  <a href={`https://wa.me/55${a.clienteTelefone}`} target="_blank" rel="noreferrer">{telefone(a.clienteTelefone)}</a>
                  {' · '}{preco(a.precoCentavos)}
                </div>
              </div>
              {a.status === 'AGENDADO' ? (
                <div className="acoes">
                  <button className="botao pequeno" onClick={() => mudar(a, 'CONCLUIDO')}>Atendido</button>
                  <button className="botao pequeno secundario" onClick={() => mudar(a, 'FALTOU')}>Faltou</button>
                  <button className="botao pequeno perigo" onClick={() => window.confirm(`Cancelar o horário de ${a.clienteNome}?`) && mudar(a, 'CANCELADO')}>Cancelar</button>
                </div>
              ) : (
                <span className={`etiqueta ${a.status.toLowerCase()}`}>{STATUS[a.status]}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
