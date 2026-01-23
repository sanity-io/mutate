import {studioTheme, ThemeProvider} from '@sanity/ui'
import {lazy, Suspense, useState, useSyncExternalStore} from 'react'
import {createRoot} from 'react-dom/client'
import {createGlobalStyle} from 'styled-components'

const Studio = lazy(() => import('./studio'))
const Preview = lazy(() => import('./preview'))

const SCROLLBAR_SIZE = 12 // px
const SCROLLBAR_BORDER_SIZE = 4 // px

const GlobalStyle = createGlobalStyle`
  html, body {
    margin: 0;
    padding: 0;
    overscroll-behavior: none;
  }

  body {
    scrollbar-gutter: stable;
  }

  ::-webkit-scrollbar {
      width: ${SCROLLBAR_SIZE}px;
      height: ${SCROLLBAR_SIZE}px;
    }

    ::-webkit-scrollbar-corner {
      background-color: transparent;
    }

    ::-webkit-scrollbar-thumb {
      background-clip: content-box;
      background-color: var(--card-border-color, ${({theme}) => theme.sanity.color.border});
      border: ${SCROLLBAR_BORDER_SIZE}px solid transparent;
      border-radius: ${SCROLLBAR_SIZE * 2}px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background-color: var(--card-muted-fg-color, ${({theme}) => theme.sanity.color.muted.fg});
    }

    ::-webkit-scrollbar-track {
      background: transparent;
    }
`

createRoot(document.getElementById('root') as HTMLElement).render(
  <ThemeProvider theme={studioTheme}>
    <Router />
    <GlobalStyle />
  </ThemeProvider>,
)

function Router() {
  const [isPreview] = useState(() => {
    const {searchParams} = new URL(location.href)
    return searchParams.has('preview')
  })
  const [isDebug] = useState(() => {
    const {searchParams} = new URL(location.href)
    return searchParams.has('debug')
  })
  // If we're being inside an iframe, or spawned from another window, render the preview
  const isStudio = useSyncExternalStore(
    subscribe,
    () => window.self === window.top && !window.opener,
  )

  return (
    <Suspense>
      {!isPreview && isStudio ? (
        <Studio debug={isDebug} />
      ) : (
        <Preview debug={isDebug} />
      )}
    </Suspense>
  )
}

const subscribe = () => () => {}
