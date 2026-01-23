import {Card, Grid} from '@sanity/ui'
import {createBrowserInspector} from '@statelyai/inspect'
import {useEffect, useRef, useState} from 'react'
import {styled} from 'styled-components'

// import * as Comlink from 'comlink'
import {globalSymbol} from '../shared/inspector'
import App from './App'
import {type InspectType} from './types'

export default function Studio(props: {debug: boolean}) {
  const {debug} = props
  const [createdInspector, setCreatedInspector] = useState(false)
  const parentInspectorIframeRef = useRef<HTMLIFrameElement | null>(null)
  const childInspectorIframeRef = useRef<HTMLIFrameElement | null>(null)
  // const [sendToPreview, setSendToPreview] = useState<
  //   null | ((event: unknown) => void)
  // >(null)

  useEffect(() => {
    if (!parentInspectorIframeRef.current) return

    const iframe = parentInspectorIframeRef.current
    const raf = requestAnimationFrame(() => {
      const inspector = createBrowserInspector({iframe})

      setInspect(inspector.inspect)
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (!childInspectorIframeRef.current) return

    const iframe = childInspectorIframeRef.current
    const raf = requestAnimationFrame(() => {
      const inspector = createBrowserInspector({iframe})

      // @ts-expect-error this is fine
      window[globalSymbol] = inspector
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  const [inspect, setInspect] = useState<InspectType>(undefined)

  return (
    <>
      <Card tone="transparent">
        <Container $debug={debug} gap={2} padding={2}>
          <Card radius={4} border style={{gridArea: 'preview'}}>
            <Iframe
              src={createdInspector || !debug ? location.href : undefined}
              // onLoad={event => {
              //   const iframe = Comlink.windowEndpoint(
              //     event.currentTarget.contentWindow!,
              //   )
              //   Comlink.expose(a => {
              //     called = true
              //     return ++a
              //   }, iframe)
              //   const proxy = Comlink.wrap(iframe)
              // }}
            />
          </Card>
          {(createdInspector || !debug) && <App inspect={inspect} />}
          {debug && (
            <Grid cols={1} rows={2} gap={2} style={{gridArea: 'inspect'}}>
              <Card radius={4} border>
                <Iframe ref={parentInspectorIframeRef} />
              </Card>
              <Card radius={4} border>
                <Iframe
                  ref={childInspectorIframeRef}
                  onLoad={() => setCreatedInspector(true)}
                />
              </Card>
            </Grid>
          )}
        </Container>
      </Card>
    </>
  )
}

const Iframe = styled.iframe`
  display: block;
  height: 100%;
  width: 100%;
  margin: 0;
  border: 0;
  background: transparent;
  overflow: auto;
  border-radius: inherit;
`

const Container = styled(Grid)<{$debug: boolean}>`
  box-sizing: border-box;
  height: 100vh;
  max-height: 100dvh;
  overflow: clip;
  overscroll-behavior: none;
  grid-template-areas: ${props =>
    props.$debug
      ? `
    'preview editor  inspect'
    'staged staged   inspect'
    'remote remote   inspect'`
      : `
    'preview editor  staged'
    'preview editor  remote'`};
  /* grid-template-columns: 2fr 2fr 3fr; */
  grid-template-columns: minmax(auto, 400px) minmax(auto, 440px) 3fr;
  grid-auto-rows: ${props =>
    props.$debug ? '1fr min-content min-content' : '1fr min-content'};
`
