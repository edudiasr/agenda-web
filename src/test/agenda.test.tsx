import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { duracao, iso, preco, proximosDias, quando as quandoFormatado, telefone } from '../formato'
import { PROFISSIONAIS, SERVICOS, agendamento, apiFalsa, quando } from './apiFalsa'

const catalogo = [
  quando('GET', '/api/servicos', { corpo: SERVICOS }),
  quando('GET', '/api/profissionais', { corpo: PROFISSIONAIS }),
]

async function escolherAteOHorario() {
  const u = userEvent.setup()
  render(<App />)
  await u.click(await screen.findByRole('button', { name: /Corte\s*30 min/ }))
  await u.click(screen.getByRole('button', { name: 'Rafael' }))
  const dias = screen.getAllByRole('button', { pressed: false }).filter((b) => b.className.includes('dia'))
  await u.click(dias[1]) // amanhã
  await u.click(await screen.findByRole('button', { name: '10:00' }))
  return u
}

describe('formatação', () => {
  it('escreve preço, duração, datas e telefone em português', () => {
    expect(preco(4500)).toBe('R$ 45,00')
    expect(duracao(30)).toBe('30 min')
    expect(duracao(90)).toBe('1 h 30 min')
    expect(quandoFormatado('2026-11-17T10:00:00')).toBe('terça-feira, 17/11 às 10:00')
    expect(telefone('47999991234')).toBe('(47) 99999-1234')
    expect(iso(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(proximosDias(3, new Date(2026, 11, 30)).map(iso)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01'])
  })
})

describe('marcar horário', () => {
  it('passa pelas etapas e mostra o código no fim', async () => {
    const chamadas = apiFalsa(
      ...catalogo,
      quando('GET', '/api/horarios', { corpo: { horarios: ['09:00:00', '10:00:00', '10:30:00'] } }),
      quando('POST', '/api/agendamentos', { status: 201, corpo: agendamento() }),
    )
    const u = await escolherAteOHorario()
    await u.type(screen.getByLabelText('Nome'), 'Lobo')
    await u.type(screen.getByLabelText('WhatsApp'), '(47) 99999-1234')
    await u.click(screen.getByRole('button', { name: 'Confirmar horário' }))

    expect(await screen.findByText('K7M2QX')).toBeInTheDocument()
    const pedido = chamadas.find((c) => c.metodo === 'POST')!
    expect(pedido.corpo).toMatchObject({ servicoId: 1, profissionalId: 1, clienteNome: 'Lobo' })
    expect((pedido.corpo as { inicio: string }).inicio).toMatch(/^\d{4}-\d{2}-\d{2}T10:00:00$/)
  })

  it('trocar o serviço limpa o horário escolhido e busca de novo', async () => {
    const chamadas = apiFalsa(...catalogo, quando('GET', '/api/horarios', { corpo: { horarios: ['10:00:00'] } }))
    const u = await escolherAteOHorario()
    expect(screen.getByLabelText('Nome')).toBeInTheDocument()

    await u.click(screen.getByRole('button', { name: /Corte e barba/ }))
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument()
    await screen.findByRole('button', { name: '10:00' })
    expect(chamadas.filter((c) => c.caminho.startsWith('/api/horarios')).at(-1)?.caminho).toContain('servicoId=3')
  })

  it('horário ocupado por outra pessoa: avisa e recarrega a lista', async () => {
    let horarios = ['10:00:00', '10:30:00']
    const chamadas = apiFalsa(
      ...catalogo,
      quando('GET', '/api/horarios', () => ({ corpo: { horarios } })),
      quando('POST', '/api/agendamentos', () => {
        horarios = ['10:30:00'] // alguém pegou o das 10h
        return { status: 409, corpo: { status: 409, detail: 'Esse horário acabou de ser ocupado. Escolha outro.' } }
      }),
    )
    const u = await escolherAteOHorario()
    await u.type(screen.getByLabelText('Nome'), 'Lobo')
    await u.type(screen.getByLabelText('WhatsApp'), '47999991234')
    await u.click(screen.getByRole('button', { name: 'Confirmar horário' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('acabou de ser ocupado')
    await screen.findByRole('button', { name: '10:30' })
    expect(screen.queryByRole('button', { name: '10:00' })).not.toBeInTheDocument()
    expect(chamadas.filter((c) => c.caminho.startsWith('/api/horarios'))).toHaveLength(2)
  })

  it('mostra a mensagem de cada campo que a API recusou', async () => {
    apiFalsa(
      ...catalogo,
      quando('GET', '/api/horarios', { corpo: { horarios: ['10:00:00'] } }),
      quando('POST', '/api/agendamentos', {
        status: 400,
        corpo: { detail: 'Confira os campos destacados.', campos: { clienteTelefone: 'Telefone no formato (47) 99999-9999' } },
      }),
    )
    const u = await escolherAteOHorario()
    await u.type(screen.getByLabelText('Nome'), 'Lobo')
    await u.type(screen.getByLabelText('WhatsApp'), '123')
    await u.click(screen.getByRole('button', { name: 'Confirmar horário' }))

    expect(await screen.findByText('Telefone no formato (47) 99999-9999')).toBeInTheDocument()
    expect(screen.getByLabelText('WhatsApp')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('WhatsApp')).toHaveAccessibleDescription('Telefone no formato (47) 99999-9999')
  })

  it('dia sem horário livre tem mensagem', async () => {
    apiFalsa(...catalogo, quando('GET', '/api/horarios', { corpo: { horarios: [] } }))
    const u = userEvent.setup()
    render(<App />)
    await u.click(await screen.findByRole('button', { name: /Corte\s*30 min/ }))
    await u.click(screen.getByRole('button', { name: 'Bruno' }))
    await u.click(screen.getAllByRole('button').filter((b) => b.className.includes('dia'))[0])
    expect(await screen.findByText(/Nenhum horário livre/)).toBeInTheDocument()
  })
})

describe('meu horário', () => {
  it('consulta pelo código e cancela', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    apiFalsa(
      quando('GET', '/api/agendamentos/K7M2QX', { corpo: agendamento() }),
      quando('POST', '/api/agendamentos/K7M2QX/cancelar', { corpo: agendamento({ status: 'CANCELADO' }) }),
    )
    window.location.hash = '#/meu-horario'
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByLabelText('Código do agendamento'), 'k7m2qx')
    await u.click(screen.getByRole('button', { name: 'Consultar' }))
    expect(await screen.findByText(/^terça-feira, 17\/11 às 10:00 · R\$\s45,00$/)).toBeInTheDocument()

    await u.click(screen.getByRole('button', { name: 'Cancelar horário' }))
    expect(await screen.findByText('cancelado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar horário' })).not.toBeInTheDocument()
  })

  it('código errado mostra o erro da API', async () => {
    apiFalsa(quando('GET', '/api/agendamentos/XXXXXX', { status: 404, corpo: { detail: 'Nenhum agendamento com esse código.' } }))
    window.location.hash = '#/meu-horario'
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByLabelText('Código do agendamento'), 'XXXXXX')
    await u.click(screen.getByRole('button', { name: 'Consultar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nenhum agendamento com esse código.')
  })
})

describe('área da barbearia', () => {
  it('login guarda o token, lista o dia e manda o token nas chamadas', async () => {
    const chamadas = apiFalsa(
      quando('POST', '/api/auth/login', { corpo: { token: 'abc.def.ghi', expiraEm: '2026-11-17T20:00:00Z', nome: 'Dono' } }),
      quando('GET', '/api/admin/agenda', {
        corpo: [
          agendamento(),
          agendamento({ id: 11, clienteNome: 'Corvo', servico: 'Corte e barba', precoCentavos: 7000, inicio: '2026-11-17T11:00:00' }),
          agendamento({ id: 12, clienteNome: 'Raposa', status: 'CANCELADO' }),
        ],
      }),
      quando('PATCH', '/api/admin/agendamentos/10/status', { corpo: agendamento({ status: 'CONCLUIDO' }) }),
    )
    window.location.hash = '#/admin'
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByLabelText('E-mail'), 'dono@barbearia.test')
    await u.type(screen.getByLabelText('Senha'), 'senha-do-dono-123')
    await u.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Corvo')).toBeInTheDocument()
    // cancelado não entra na conta do previsto: 45 + 70
    expect(screen.getByText(/^2 atendimento\(s\) · previsto R\$\s115,00$/)).toBeInTheDocument()
    expect(sessionStorage.getItem('agenda.token')).toBe('abc.def.ghi')
    expect(chamadas.find((c) => c.caminho.startsWith('/api/admin/agenda'))?.auth).toBe('Bearer abc.def.ghi')

    const linhaLobo = screen.getByText('Lobo').closest('li')!
    await u.click(within(linhaLobo).getByRole('button', { name: 'Atendido' }))
    expect(await within(linhaLobo).findByText('concluído')).toBeInTheDocument()
  })

  it('token vencido (401) volta pro login', async () => {
    sessionStorage.setItem('agenda.token', 'vencido')
    apiFalsa(quando('GET', '/api/admin/agenda', { status: 401, corpo: {} }))
    window.location.hash = '#/admin'
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(sessionStorage.getItem('agenda.token')).toBeNull()
  })
})

describe('servidor dormindo', () => {
  it('avisa quando a resposta demora', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let liberar: () => void = () => {}
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((ok) => {
      liberar = () => ok(new Response(JSON.stringify([]), { status: 200 }))
    })))
    render(<App />)
    await act(async () => { await vi.advanceTimersByTimeAsync(4500) })
    expect(screen.getByRole('status')).toHaveTextContent('acordando')
    await act(async () => { liberar() })
    vi.useRealTimers()
  })
})
