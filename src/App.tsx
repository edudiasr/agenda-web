import { useEffect, useState } from 'react'
import { aoDemorar } from './api'
import { Admin } from './paginas/Admin'
import { Agendar } from './paginas/Agendar'
import { MeuHorario } from './paginas/MeuHorario'
import { useRota } from './rota'

export function App() {
  const rota = useRota()
  const [demorando, setDemorando] = useState(false)
  useEffect(() => aoDemorar(setDemorando), [])

  const links: Array<[string, string]> = [['/', 'Agendar'], ['/meu-horario', 'Meu horário'], ['/admin', 'Barbearia']]

  return (
    <>
      <header className="topo">
        <a href="#/" className="marca">Navalha <span>Barbearia</span></a>
        <nav>
          {links.map(([caminho, nome]) => (
            <a key={caminho} href={`#${caminho}`} aria-current={rota === caminho ? 'page' : undefined}>{nome}</a>
          ))}
        </nav>
      </header>
      {demorando && (
        <p className="aviso-demora" role="status">
          O servidor está acordando (no plano gratuito ele dorme quando ninguém usa). Leva uns segundos na primeira vez.
        </p>
      )}
      <main className="conteudo">
        {rota === '/meu-horario' ? <MeuHorario /> : rota === '/admin' ? <Admin /> : <Agendar />}
      </main>
    </>
  )
}
