import {useGLTF} from '@react-three/drei'
import {type Infer} from '@sanity/sanitype'
import {forwardRef} from 'react'
import {type Group, type Object3DEventMap} from 'three'

import {type airmax, type dunklow, type ultraboost} from '../studio/schema/shoe'

export const AirmaxModel = forwardRef<
  Group<Object3DEventMap>,
  {model: Infer<typeof airmax>}
>(function AirmaxModel(props, forwardedRef) {
  const {model} = props
  const {nodes, materials} = useGLTF('/shoe-airmax.glb')

  const color = materials.ASSET_MAT_MR?.clone()
  const gel = materials.ASSET_MAT_MR?.clone()

  return (
    <group ref={forwardedRef} scale={[6, 6, 6]}>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.mesh_49?.geometry}
        material={color}
        material-name="color"
        material-color={model['color']}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.mesh_49_1?.geometry}
        material={gel}
        material-name="gel"
        material-color={model['gel']}
      />
    </group>
  )
})

export const DunklowModel = forwardRef<
  Group<Object3DEventMap>,
  {model: Infer<typeof dunklow>}
>(function DunklowModel(props, forwardedRef) {
  const {model} = props
  const {nodes, materials} = useGLTF('/shoe-dunklow.glb')

  const towel = materials['Fluffy White Towel']?.clone()
  const neck = materials['Material.011']?.clone()
  const soleTop = materials['Material.012']?.clone()
  const soleBottom = materials['Material.013']?.clone()
  const nikeLogo = materials['Material.001']?.clone()
  const coatFront = materials['Material.002']?.clone()
  const coatMiddle = materials['Material.002']?.clone()
  const coatBack = materials['Material.002']?.clone()
  const patch = materials['Material.006']?.clone()
  const laces = materials['Material.003']?.clone()
  const nikeText = materials.Material?.clone()
  const inner = nodes.desighn_00?.material?.clone()

  return (
    <group
      ref={forwardedRef}
      scale={[0.5, 0.5, 0.5]}
      rotation={[0, 3, 0]}
      position={[0, 0.33, 0]}
    >
      <group
        position={[0, -0.176, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[1, 1.099, 1]}
      >
        <mesh
          // towel
          castShadow
          receiveShadow
          geometry={nodes.Plane?.geometry}
          material={towel}
          material-name="towel"
          material-color={model.towel}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Plane_1?.geometry}
          material={neck}
          material-name="neck"
          material-color={model.neck}
        />
      </group>
      <group
        position={[0, -0.025, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[1, 1.099, 1.475]}
      >
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Plane001?.geometry}
          material={soleTop}
          material-name="soleTop"
          material-color={model['soleTop']}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Plane001_1?.geometry}
          material={soleBottom}
          material-name="soleBottom"
          material-color={model['soleBottom']}
        />
      </group>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.design_3?.geometry}
        position={[0, -0.176, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[1, 1.099, 1]}
        material={coatBack}
        material-name="coatBack"
        material-color={model['coatBack']}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.nikey_logo?.geometry}
        position={[0, -0.176, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[1, 1.099, 1]}
        material={nikeLogo}
        material-name="nikeLogo"
        material-color={model['nikeLogo']}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.design1?.geometry}
        position={[0, -0.176, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[1, 1.099, 1]}
        material={coatFront}
        material-name="coatFront"
        material-color={model['coatFront']}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.design_2?.geometry}
        position={[0, -0.176, 0]}
        rotation={[0.667, 0.287, 0.335]}
        scale={[0.619, 0.927, 0.155]}
        material={coatMiddle}
        material-name="coatMiddle"
        material-color={model['coatMiddle']}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.desighn_4?.geometry}
        position={[0, -0.176, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[1, 1.099, 1]}
        material={patch}
        material-name="patch"
        material-color={model['patch']}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.laces?.geometry}
        position={[-0.46, 1.045, -0.001]}
        rotation={[1.529, -1.161, 1.532]}
        scale={[0.476, 0.502, 0.018]}
        material={laces}
        material-name="laces"
        material-color={model['laces']}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Text?.geometry}
        position={[1.987, 1.218, -0.034]}
        rotation={[Math.PI / 2, 0, -Math.PI / 2]}
        scale={0.193}
        material={nikeText}
        material-name="nikeText"
        material-color={model['nikeText']}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.desighn_00?.geometry}
        position={[0, -0.076, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[0.943, 0.857, 0.922]}
        material={inner}
        material-name="inner"
        material-color={model['inner']}
      />
    </group>
  )
})

export const UltraboostModel = forwardRef<
  Group<Object3DEventMap>,
  {model: Infer<typeof ultraboost>}
>(function UltraboostModel(props, forwardedRef) {
  const {model} = props
  const {nodes, materials} = useGLTF('/shoe-ultraboost.glb')

  const laces = materials.laces?.clone()
  const mesh = materials.mesh?.clone()
  const caps = materials.caps?.clone()
  const inner = materials.inner?.clone()
  const sole = materials.sole?.clone()
  const stripes = materials.stripes?.clone()
  const band = materials.band?.clone()
  const patch = materials.patch?.clone()

  return (
    <group ref={forwardedRef}>
      <mesh
        receiveShadow
        castShadow
        geometry={nodes.shoe?.geometry}
        material={laces}
        material-color={model.laces}
      />
      <mesh
        receiveShadow
        castShadow
        geometry={nodes.shoe_1?.geometry}
        material={mesh}
        material-color={model.mesh}
      />
      <mesh
        receiveShadow
        castShadow
        geometry={nodes.shoe_2?.geometry}
        material={caps}
        material-color={model.caps}
      />
      <mesh
        receiveShadow
        castShadow
        geometry={nodes.shoe_3?.geometry}
        material={inner}
        material-color={model.inner}
      />
      <mesh
        receiveShadow
        castShadow
        geometry={nodes.shoe_4?.geometry}
        material={sole}
        material-color={model.sole}
      />

      <mesh
        receiveShadow
        castShadow
        geometry={nodes.shoe_5?.geometry}
        material={stripes}
        material-color={model.stripes}
      />
      <mesh
        receiveShadow
        castShadow
        geometry={nodes.shoe_6?.geometry}
        material={band}
        material-color={model.band}
      />
      <mesh
        receiveShadow
        castShadow
        geometry={nodes.shoe_7?.geometry}
        material={patch}
        material-color={model.patch}
      />
    </group>
  )
})
