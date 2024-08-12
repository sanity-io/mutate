import {useGLTF, View} from '@react-three/drei'
import {Canvas} from '@react-three/fiber'
import {Card, Grid} from '@sanity/ui'
import {useEffect, useMemo, useRef, useState} from 'react'
import {styled} from 'styled-components'

// import * as Comlink from 'comlink'
import {
  globalSymbol,
  type InspectorInspectContextValue,
} from '../shared/inspector'
import App from './App'
import {VisualEditingProvider} from './context'

useGLTF.preload([
  '/shoe-airmax.glb',
  '/shoe-dunklow.glb',
  '/shoe-ultraboost.glb',
])

export default function Preview(props: {debug: boolean}) {
  const {debug} = props
  const eventSourceRef = useRef<HTMLDivElement | null>(null)
  const [mounted, setMounted] = useState(!debug)
  const [inspect, setInspect] =
    useState<InspectorInspectContextValue>(undefined)

  // useEffect(() => {
  //   function send(event: unknown) {
  //     console.log('send', event)
  //   }
  //   Comlink.expose(send, Comlink.windowEndpoint(self.parent))
  // }, [])

  useEffect(() => {
    if (mounted) return

    const raf = requestAnimationFrame(() => {
      setMounted(true)
      // @ts-expect-error this is fine
      const inspector = parent.window[globalSymbol]
      if (inspector) setInspect(inspector.inspect)
    })
    return () => cancelAnimationFrame(raf)
  }, [mounted])

  const visualEditingOptions = useMemo(() => ({inspect}), [inspect])

  return (
    <>
      <Card ref={eventSourceRef}>
        {mounted && (
          <Container padding={3}>
            <VisualEditingProvider options={visualEditingOptions}>
              <App />
            </VisualEditingProvider>
          </Container>
        )}
        <StyledCanvas
          shadows
          // @ts-expect-error this is fine
          eventSource={eventSourceRef}
          camera={{position: [0, 0, 4], fov: 45}}
        >
          <View.Port />
        </StyledCanvas>
      </Card>
    </>
  )
}

const Container = styled(Grid)`
  box-sizing: border-box;
  height: 100vh;
  max-height: 100dvh;
  overflow: clip;
  overscroll-behavior: none;
  grid-auto-rows: min-content 1fr;
`

const StyledCanvas = styled(Canvas)`
  pointer-events: none;
  position: absolute !important;
  top: 0.75rem;
  left: 0.75rem;
  bottom: 0.75rem;
  right: 0.75rem;
  height: auto !important;
  width: auto !important;
`
