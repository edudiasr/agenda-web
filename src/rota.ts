import { useSyncExternalStore } from 'react'

// Rotas pelo "#" da URL (#/admin, #/meu-horario): funciona no GitHub Pages, que só serve arquivos
// estáticos e não sabe redirecionar /admin pro index.html.

function atual(): string {
  return window.location.hash.replace(/^#/, '') || '/'
}

function assinar(aviso: () => void) {
  window.addEventListener('hashchange', aviso)
  return () => window.removeEventListener('hashchange', aviso)
}

export function useRota(): string {
  return useSyncExternalStore(assinar, atual)
}

export function ir(caminho: string) {
  window.location.hash = caminho
}
