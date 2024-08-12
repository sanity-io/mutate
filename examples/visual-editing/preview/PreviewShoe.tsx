import {
  ContactShadows,
  Environment,
  PerspectiveCamera,
  View,
} from '@react-three/drei'
import {useFrame} from '@react-three/fiber'
import {type Infer} from '@sanity/sanitype'
import {Box, Heading} from '@sanity/ui'
import {useRef} from 'react'
import {styled} from 'styled-components'
import {type Group, type Object3DEventMap} from 'three'

import {type airmax, type dunklow, type ultraboost} from '../studio/schema/shoe'
import {AirmaxModel, DunklowModel, UltraboostModel} from './Shoes'

const StyledView = styled(View)`
  height: 100%;
  width: 100%;
`

export default function PreviewShoe(
  props: {
    title: string | undefined
  } & Pick<
    | React.ComponentProps<typeof PreviewAirmaxShoe>
    | React.ComponentProps<typeof PreviewDunklowShoe>
    | React.ComponentProps<typeof PreviewUltraboostShoe>,
    'model' | 'scrollRef' | 'offsetLeft'
  >,
) {
  const {title, scrollRef, model, offsetLeft} = props

  return (
    <>
      <Box
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          top: 0,
          left: 0,
          position: 'absolute',
        }}
        padding={3}
      >
        <Heading as="h2" size={1} style={{textWrap: 'pretty'}}>
          {title || 'Untitled'}
        </Heading>
      </Box>
      <StyledView>
        <ambientLight intensity={0.7} />
        <spotLight
          intensity={0.5}
          angle={0.1}
          penumbra={1}
          position={[10, 15, 10]}
          castShadow
        />
        {model._type === 'airmax' ? (
          <PreviewAirmaxShoe
            model={model}
            scrollRef={scrollRef}
            offsetLeft={offsetLeft}
          />
        ) : model._type === 'dunklow' ? (
          <PreviewDunklowShoe
            model={model}
            scrollRef={scrollRef}
            offsetLeft={offsetLeft}
          />
        ) : (
          <PreviewUltraboostShoe
            model={model}
            scrollRef={scrollRef}
            offsetLeft={offsetLeft}
          />
        )}

        <Environment preset="city" />
        <ContactShadows
          position={[0, -0.8, 0]}
          opacity={0.25}
          scale={10}
          blur={1.5}
          far={0.8}
        />
        <PerspectiveCamera
          makeDefault
          fov={20}
          position={[0, 0, 10]}
          zoom={1.5}
        />
      </StyledView>
    </>
  )
}

function PreviewAirmaxShoe(props: {
  model: Infer<typeof airmax>
  scrollRef: React.MutableRefObject<number>
  offsetLeft: number
}) {
  const {offsetLeft, scrollRef, model} = props
  const ref = useRef<Group<Object3DEventMap>>(null)

  useFrame(state => {
    if (!ref.current) return
    const t = state.clock.getElapsedTime()
    ref.current.rotation.set(
      Math.cos(t / 4) / 8,
      -5 + Math.sin(t / 4) / 8 + (offsetLeft + scrollRef.current * 3 - 1000),
      (3 + Math.sin(t / 1.5)) / 20,
    )
    ref.current.position.y = (1 + Math.sin((t + offsetLeft) / 1.5)) / 10 - 0.5
  })

  return <AirmaxModel ref={ref} model={model} />
}

function PreviewDunklowShoe(props: {
  model: Infer<typeof dunklow>
  scrollRef: React.MutableRefObject<number>
  offsetLeft: number
}) {
  const {offsetLeft, scrollRef, model} = props
  const ref = useRef<Group<Object3DEventMap>>(null)
  useFrame(state => {
    if (!ref.current) return
    const t = state.clock.getElapsedTime()
    ref.current.rotation.set(
      Math.cos(t / 4) / 8,
      3 + Math.sin(t / 4) / 8 + (offsetLeft + scrollRef.current * 3 - 1000),
      0.2 - (1 + Math.sin(t / 1.5)) / 20,
    )
    ref.current.position.y = (1 + Math.sin((t + offsetLeft) / 1.5)) / 10 - 0.5
  })
  return <DunklowModel ref={ref} model={model} />
}

function PreviewUltraboostShoe(props: {
  model: Infer<typeof ultraboost>
  scrollRef: React.MutableRefObject<number>
  offsetLeft: number
}) {
  const {offsetLeft, scrollRef, model} = props
  const ref = useRef<Group<Object3DEventMap>>(null)

  useFrame(state => {
    if (!ref.current) return
    const t = state.clock.getElapsedTime()
    ref.current.rotation.set(
      Math.cos(t / 4) / 8,
      Math.sin(t / 4) / 8 + (offsetLeft + scrollRef.current * 3 - 1000),
      -0.2 - (1 + Math.sin(t / 1.5)) / 20,
    )
    ref.current.position.y = (1 + Math.sin((t + offsetLeft) / 1.5)) / 10
  })

  return <UltraboostModel ref={ref} model={model} />
}
