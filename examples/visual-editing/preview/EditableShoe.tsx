import {
  ContactShadows,
  Environment,
  OrbitControls,
  View,
} from '@react-three/drei'
import {useFrame} from '@react-three/fiber'
import {type Infer} from '@sanity/sanitype'
import {Box, Card, Heading, Inline} from '@sanity/ui'
import {useEffect, useRef, useState} from 'react'
import {HexColorPicker} from 'react-colorful'
import {styled} from 'styled-components'
import {type Group, type Object3DEventMap} from 'three'

import {type airmax, type dunklow, type ultraboost} from '../studio/schema/shoe'
import {AirmaxModel, DunklowModel, UltraboostModel} from './Shoes'

const StyledView = styled(View)`
  height: 100%;
  width: 100%;
`

export default function EditableShoe(props: {
  documentId: string
  title: string | undefined
  model: Infer<typeof airmax | typeof dunklow | typeof ultraboost>
}) {
  const {title, documentId} = props
  const ref = useRef<HTMLDivElement | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)

  const [model, mutateModel] = useState(() => props.model as any)

  const [syncedId, setSyncedId] = useState(() => props.documentId)
  useEffect(() => {
    if (documentId !== syncedId) {
      mutateModel(props.model as any)
      setSyncedId(documentId)
    }
  }, [documentId, props.model, syncedId])

  const [hovered, setHovered] = useState(null)
  useEffect(() => {
    const el = ref.current
    if (!hovered || !el) return

    const cursor = `<svg width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0)"><path fill="rgba(255, 255, 255, 0.5)" d="M29.5 54C43.031 54 54 43.031 54 29.5S43.031 5 29.5 5 5 15.969 5 29.5 15.969 54 29.5 54z" stroke="#000"/><g filter="url(#filter0_d)"><path d="M29.5 47C39.165 47 47 39.165 47 29.5S39.165 12 29.5 12 12 19.835 12 29.5 19.835 47 29.5 47z" fill="${model[hovered]}"/></g><path d="M2 2l11 2.947L4.947 13 2 2z" fill="#000"/><text fill="#000" style="#fff-space:pre" font-family="Inter var, sans-serif" font-size="10" letter-spacing="-.01em"><tspan x="35" y="63">${hovered}</tspan></text></g><defs><clipPath id="clip0"><path fill="#fff" d="M0 0h64v64H0z"/></clipPath><filter id="filter0_d" x="6" y="8" width="47" height="47" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"/><feOffset dy="2"/><feGaussianBlur stdDeviation="3"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.15 0"/><feBlend in2="BackgroundImageFix" result="effect1_dropShadow"/><feBlend in="SourceGraphic" in2="effect1_dropShadow" result="shape"/></filter></defs></svg>`
    const auto = `<svg width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="rgba(255, 255, 255, 0.5)" d="M29.5 54C43.031 54 54 43.031 54 29.5S43.031 5 29.5 5 5 15.969 5 29.5 15.969 54 29.5 54z" stroke="#000"/><path d="M2 2l11 2.947L4.947 13 2 2z" fill="#000"/></svg>`
    el.style.cursor = `url('data:image/svg+xml;base64,${btoa(cursor)}'), auto`
    return () => {
      el.style.cursor = `url('data:image/svg+xml;base64,${btoa(auto)}'), auto`
    }
  }, [hovered, model])

  return (
    <Card
      ref={ref}
      radius={3}
      height="stretch"
      tone="transparent"
      style={{position: 'relative'}}
    >
      <Box
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          bottom: 0,
          left: 0,
          position: 'absolute',
        }}
        padding={3}
      >
        <Heading as="h1" size={5} style={{textWrap: 'pretty'}}>
          {props.model ? title || 'Untitled' : 'Loading…'}
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
        <group
          onPointerOver={e => (
            e.stopPropagation(), setHovered(e.object.material.name)
          )}
          onPointerOut={e => e.intersections.length === 0 && setHovered(null)}
          onPointerMissed={() => setSelectedColor(null)}
          onClick={e => (
            e.stopPropagation(), setSelectedColor(e.object.material.name)
          )}
        >
          {model._type === 'airmax' ? (
            <EditableAirmaxShoe model={model} />
          ) : model._type === 'dunklow' ? (
            <EditableDunklowShoe model={model} />
          ) : (
            <EditableUltraboostShoe model={model} />
          )}
        </group>
        <Environment preset="city" />
        <ContactShadows
          position={[0, -0.8, 0]}
          opacity={0.25}
          scale={10}
          blur={1.5}
          far={0.8}
        />
        <OrbitControls
          minPolarAngle={Math.PI / 2}
          maxPolarAngle={Math.PI / 2}
          enableZoom={false}
          enablePan={false}
        />
      </StyledView>
      <Picker
        model={model}
        mutateModel={mutateModel}
        selectedColor={selectedColor}
      />
    </Card>
  )
}

function EditableAirmaxShoe(props: {model: Infer<typeof airmax>}) {
  const {model} = props
  const ref = useRef<Group<Object3DEventMap>>(null)

  useFrame(state => {
    if (!ref.current) return
    const t = state.clock.getElapsedTime()
    ref.current.rotation.set(
      Math.cos(t / 4) / 8,
      -5 + Math.sin(t / 4) / 8,
      (3 + Math.sin(t / 1.5)) / 20,
    )
    ref.current.position.y = (1 + Math.sin(t / 1.5)) / 10 - 0.5
  })

  return <AirmaxModel ref={ref} model={model} />
}

function EditableDunklowShoe(props: {model: Infer<typeof dunklow>}) {
  const {model} = props
  const ref = useRef<Group<Object3DEventMap>>(null)

  useFrame(state => {
    if (!ref.current) return
    const t = state.clock.getElapsedTime()
    ref.current.rotation.set(
      Math.cos(t / 4) / 8,
      3 + Math.sin(t / 4) / 8,
      0.2 - (1 + Math.sin(t / 1.5)) / 20,
    )
    ref.current.position.y = (1 + Math.sin(t / 1.5)) / 10 - 0.5
  })

  return <DunklowModel ref={ref} model={model} />
}

function EditableUltraboostShoe(props: {model: Infer<typeof ultraboost>}) {
  const {model} = props
  const ref = useRef<Group<Object3DEventMap>>(null)

  useFrame(state => {
    if (!ref.current) return
    const t = state.clock.getElapsedTime()
    ref.current.rotation.set(
      Math.cos(t / 4) / 8,
      Math.sin(t / 4) / 8,
      -0.2 - (1 + Math.sin(t / 1.5)) / 20,
    )
    ref.current.position.y = (1 + Math.sin(t / 1.5)) / 10
  })

  return <UltraboostModel ref={ref} model={model} />
}

function Picker({
  model,
  selectedColor,
  mutateModel,
}: {
  model: Infer<typeof airmax | typeof dunklow | typeof ultraboost>
  selectedColor: string | null
  mutateModel: React.Dispatch<
    React.SetStateAction<
      Infer<typeof airmax | typeof dunklow | typeof ultraboost>
    >
  >
}) {
  return (
    <Inline
      style={{
        display: selectedColor ? 'block' : 'none',
        position: 'absolute',
        top: 0,
        left: 0,
      }}
      paddingX={3}
      paddingTop={2}
      space={4}
    >
      <HexColorPicker
        className="picker"
        style={{height: 90, width: 90}}
        color={model[selectedColor!]}
        onChange={color =>
          mutateModel(prev => ({...prev, [selectedColor!]: color}))
        }
      />
      <Heading
        size={3}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          textTransform: 'capitalize',
        }}
      >
        {selectedColor}
      </Heading>
    </Inline>
  )
}
