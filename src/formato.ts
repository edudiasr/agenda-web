const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function preco(centavos: number): string {
  return reais.format(centavos / 100)
}

export function duracao(minutos: number): string {
  return minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)} h${minutos % 60 ? ` ${minutos % 60} min` : ''}`
}

/** "2026-11-17" a partir de uma data, no fuso do navegador (sem passar por UTC). */
export function iso(data: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`
}

/** Próximos N dias a partir de hoje. */
export function proximosDias(quantos: number, hoje = new Date()): Date[] {
  return Array.from({ length: quantos }, (_, i) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i))
}

export function diaCurto(data: Date): { semana: string; dia: string } {
  return {
    semana: data.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
    dia: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
  }
}

/** "terça, 17/11 às 10:00" a partir de "2026-11-17T10:00:00" (horário local da barbearia). */
export function quando(inicio: string): string {
  const [data, hora] = inicio.split('T')
  const [a, m, d] = data.split('-').map(Number)
  const semana = new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long' })
  return `${semana}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} às ${hora.slice(0, 5)}`
}

export function telefone(digitos: string): string {
  const d = digitos.replace(/\D/g, '')
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : digitos
}

export const STATUS: Record<string, string> = {
  AGENDADO: 'agendado',
  CANCELADO: 'cancelado',
  CONCLUIDO: 'concluído',
  FALTOU: 'faltou',
}
