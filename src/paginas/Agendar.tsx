import { useEffect, useState, type FormEvent } from 'react'
import { api, ErroDaApi, type Agendamento, type Profissional, type Servico } from '../api'
import { diaCurto, duracao, iso, preco, proximosDias, quando } from '../formato'

/**
 * Marcação em etapas: serviço → profissional → dia → horário → dados → confirmação.
 * Cada escolha limpa as que dependem dela (trocar o serviço muda os horários livres, por exemplo).
 */
export function Agendar() {
  const [servicos, setServicos] = useState<Servico[]>()
  const [profissionais, setProfissionais] = useState<Profissional[]>()
  const [erroInicial, setErroInicial] = useState<string>()

  const [servico, setServico] = useState<Servico>()
  const [profissional, setProfissional] = useState<Profissional>()
  const [dia, setDia] = useState<string>()
  const [horarios, setHorarios] = useState<string[]>()
  const [hora, setHora] = useState<string>()
  const [recarregar, setRecarregar] = useState(0)

  const [nome, setNome] = useState('')
  const [fone, setFone] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string>()
  const [erros, setErros] = useState<Record<string, string>>({})
  const [feito, setFeito] = useState<Agendamento>()

  useEffect(() => {
    Promise.all([api.servicos(), api.profissionais()]).then(
      ([s, p]) => {
        setServicos(s)
        setProfissionais(p)
      },
      (e: Error) => setErroInicial(e.message),
    )
  }, [])

  // horários livres: busca de novo quando muda serviço, profissional ou dia
  useEffect(() => {
    if (!servico || !profissional || !dia) return
    let valido = true
    api.horarios(profissional.id, servico.id, dia).then(
      (h) => valido && setHorarios(h),
      (e: Error) => valido && setErro(e.message),
    )
    return () => {
      valido = false
    }
  }, [servico, profissional, dia, recarregar])

  function escolherServico(s: Servico) {
    setServico(s)
    setHorarios(undefined)
    setHora(undefined)
  }

  function escolherProfissional(p: Profissional) {
    setProfissional(p)
    setHorarios(undefined)
    setHora(undefined)
  }

  function escolherDia(d: string) {
    setDia(d)
    setHorarios(undefined)
    setHora(undefined)
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault()
    if (!servico || !profissional || !dia || !hora) return
    setEnviando(true)
    setErro(undefined)
    setErros({})
    try {
      setFeito(await api.agendar({
        servicoId: servico.id, profissionalId: profissional.id,
        inicio: `${dia}T${hora}:00`, clienteNome: nome, clienteTelefone: fone,
      }))
    } catch (err) {
      if (err instanceof ErroDaApi && err.status === 409) {
        // alguém marcou esse horário antes: atualiza a lista e pede outro
        setHora(undefined)
        setRecarregar((n) => n + 1)
      }
      if (err instanceof ErroDaApi) setErros(err.campos)
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  if (feito) {
    return (
      <section className="cartao confirmado" aria-live="polite">
        <h2>Horário marcado</h2>
        <p><strong>{feito.servico}</strong> com {feito.profissional}, {quando(feito.inicio)}.</p>
        <p>Seu código:</p>
        <p className="codigo">{feito.codigo}</p>
        <p className="suave">Guarde esse código: com ele você consulta ou cancela o horário em “Meu horário”.</p>
        <button className="botao secundario" onClick={() => window.location.reload()}>Marcar outro</button>
      </section>
    )
  }

  if (erroInicial) return <p className="alerta">{erroInicial}</p>
  if (!servicos || !profissionais) return <p className="suave">Carregando…</p>

  const dias = proximosDias(14)

  return (
    <div className="etapas">
      <section>
        <h2><span className="passo">1</span> Serviço</h2>
        <div className="opcoes">
          {servicos.map((s) => (
            <button key={s.id} className={`opcao ${servico?.id === s.id ? 'escolhida' : ''}`}
              aria-pressed={servico?.id === s.id} onClick={() => escolherServico(s)}>
              <strong>{s.nome}</strong>
              <span>{duracao(s.duracaoMinutos)} · {preco(s.precoCentavos)}</span>
            </button>
          ))}
        </div>
      </section>

      {servico && (
        <section>
          <h2><span className="passo">2</span> Profissional</h2>
          <div className="opcoes">
            {profissionais.map((p) => (
              <button key={p.id} className={`opcao ${profissional?.id === p.id ? 'escolhida' : ''}`}
                aria-pressed={profissional?.id === p.id} onClick={() => escolherProfissional(p)}>
                <strong>{p.nome}</strong>
              </button>
            ))}
          </div>
        </section>
      )}

      {profissional && (
        <section>
          <h2><span className="passo">3</span> Dia</h2>
          <div className="dias">
            {dias.map((d) => {
              const { semana, dia: dm } = diaCurto(d)
              return (
                <button key={iso(d)} className={`dia ${dia === iso(d) ? 'escolhida' : ''}`}
                  aria-pressed={dia === iso(d)} aria-label={`${semana} ${dm}`} onClick={() => escolherDia(iso(d))}>
                  <span>{semana}</span><strong>{dm}</strong>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {dia && (
        <section>
          <h2><span className="passo">4</span> Horário</h2>
          {!horarios && <p className="suave">Buscando horários…</p>}
          {horarios?.length === 0 && <p className="suave">Nenhum horário livre nesse dia. Tente outro dia ou outro profissional.</p>}
          {horarios && horarios.length > 0 && (
            <div className="horas">
              {horarios.map((h) => (
                <button key={h} className={`hora ${hora === h ? 'escolhida' : ''}`} aria-pressed={hora === h}
                  onClick={() => setHora(h)}>{h}</button>
              ))}
            </div>
          )}
        </section>
      )}

      {hora && (
        <section>
          <h2><span className="passo">5</span> Seus dados</h2>
          <form onSubmit={confirmar} className="formulario" noValidate>
            {/* a mensagem de erro fica fora do <label> e ligada por aria-describedby:
                assim o leitor de tela anuncia "Nome" como nome do campo e o erro como descrição */}
            <div className="campo">
              <label htmlFor="nome">Nome</label>
              <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required
                aria-invalid={!!erros.clienteNome} aria-describedby={erros.clienteNome ? 'erro-nome' : undefined} />
              {erros.clienteNome && <small id="erro-nome" className="erro-campo">{erros.clienteNome}</small>}
            </div>
            <div className="campo">
              <label htmlFor="fone">WhatsApp</label>
              <input id="fone" value={fone} onChange={(e) => setFone(e.target.value)} inputMode="tel" autoComplete="tel"
                placeholder="(47) 99999-9999" required aria-invalid={!!erros.clienteTelefone}
                aria-describedby={erros.clienteTelefone ? 'erro-fone' : undefined} />
              {erros.clienteTelefone && <small id="erro-fone" className="erro-campo">{erros.clienteTelefone}</small>}
            </div>
            <p className="resumo">
              {servico?.nome} com {profissional?.nome}, {quando(`${dia}T${hora}`)} · {servico && preco(servico.precoCentavos)}
            </p>
            {erro && <p className="alerta" role="alert">{erro}</p>}
            <button className="botao" disabled={enviando}>{enviando ? 'Marcando…' : 'Confirmar horário'}</button>
          </form>
        </section>
      )}

      {erro && !hora && <p className="alerta" role="alert">{erro}</p>}
    </div>
  )
}
