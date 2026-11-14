import { useState, type FormEvent } from 'react'
import { api, type Agendamento } from '../api'
import { STATUS, preco, quando } from '../formato'

export function MeuHorario() {
  const [codigo, setCodigo] = useState('')
  const [agendamento, setAgendamento] = useState<Agendamento>()
  const [erro, setErro] = useState<string>()
  const [ocupado, setOcupado] = useState(false)

  async function executar(acao: () => Promise<Agendamento>) {
    setOcupado(true)
    setErro(undefined)
    try {
      setAgendamento(await acao())
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  function buscar(e: FormEvent) {
    e.preventDefault()
    setAgendamento(undefined)
    void executar(() => api.consultar(codigo))
  }

  return (
    <section className="cartao estreito">
      <h2>Meu horário</h2>
      <form onSubmit={buscar} className="linha">
        <label className="oculto" htmlFor="codigo">Código do agendamento</label>
        <input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder="Código (ex.: K7M2QX)" maxLength={8} className="campo-codigo" required />
        <button className="botao" disabled={ocupado}>Consultar</button>
      </form>

      {erro && <p className="alerta" role="alert">{erro}</p>}

      {agendamento && (
        <div className="detalhe">
          <p><strong>{agendamento.servico}</strong> com {agendamento.profissional}</p>
          <p>{quando(agendamento.inicio)} · {preco(agendamento.precoCentavos)}</p>
          <p>Situação: <span className={`etiqueta ${agendamento.status.toLowerCase()}`}>{STATUS[agendamento.status]}</span></p>
          {agendamento.status === 'AGENDADO' && (
            <button className="botao perigo" disabled={ocupado}
              onClick={() => window.confirm('Cancelar esse horário?') && executar(() => api.cancelar(agendamento.codigo))}>
              Cancelar horário
            </button>
          )}
        </div>
      )}
    </section>
  )
}
