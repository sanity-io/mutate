import {EllipsisVerticalIcon, TransferIcon, TrashIcon} from '@sanity/icons'
import {assign, at, set, unset} from '@sanity/mutate'
import {
  getInstanceName,
  isNeverSchema,
  isObjectSchema,
  type ObjectUnionFormDef,
  pickDeep,
  type SanityObjectUnion,
} from '@sanity/sanitype'
import {
  Box,
  Button,
  Card,
  Flex,
  Menu,
  MenuButton,
  type MenuButtonProps,
  MenuDivider,
  MenuGroup,
  MenuItem,
  Select,
  Stack,
  Text,
} from '@sanity/ui'
import {startCase} from 'lodash'
import {useCallback} from 'react'

import {type InputProps, type PatchEvent} from '../types'
import {ObjectInput} from './objects/ObjectInput'

const NESTED_POPOVER_PROPS: MenuButtonProps['popover'] = {
  placement: 'right-start',
  portal: true,
  preventOverflow: true,
}

export function UnionInput(props: InputProps<SanityObjectUnion>) {
  const {value, schema, onPatch, path, form, renderInput} = props
  const valueTypeName = value?._type

  const currentSchema = valueTypeName
    ? schema.union.find(
        ut => !isNeverSchema(ut) && getInstanceName(ut) === valueTypeName,
      )
    : undefined

  const handlePatch = useCallback(
    (patchEvent: PatchEvent) => {
      if (!currentSchema) {
        // note: this should never happen
        throw new Error(`Cannot apply patch. No current to apply patch to`)
      }
      onPatch(patchEvent)
    },
    [onPatch, currentSchema],
  )

  const handleTurnInto = useCallback(
    (nextTypeName: string) => {
      const nextSchema = schema.union.find(
        ut => !isNeverSchema(ut) && getInstanceName(ut) === nextTypeName,
      )
      if (!nextSchema) {
        throw new Error(`No valid union type named ${nextTypeName}.`)
      }
      onPatch({
        patches: [
          at([], set({_type: nextTypeName})),
          at([], assign(pickDeep(nextSchema, value))),
        ],
      })
    },
    [onPatch, value, schema],
  )

  const handleSelectType = useCallback(
    (nextTypeName: string) => {
      const nextSchema = schema.union.find(
        ut => !isNeverSchema(ut) && getInstanceName(ut) === nextTypeName,
      )
      if (!nextSchema) {
        throw new Error(`No valid union type named ${nextTypeName}.`)
      }
      onPatch({
        patches: [at([], set({_type: nextTypeName}))],
      })
    },
    [schema.union, onPatch],
  )

  const handleClear = useCallback(
    () =>
      onPatch({
        patches: [at([], unset())],
      }),
    [onPatch],
  )

  if (!currentSchema) {
    return (
      <Select onChange={e => handleSelectType(e.currentTarget.value)}>
        <option value="">Select type</option>
        {schema.union.map(ut => {
          const name = !isNeverSchema(ut) && getInstanceName(ut)
          if (!name || !(name in form.types)) {
            throw new Error(`No form definition found for type ${name}`)
          }
          const formDef = (form.types as any)[name] as ObjectUnionFormDef<any>
          return (
            <option key={name} value={name}>
              {formDef?.title}
            </option>
          )
        })}
      </Select>
    )
  }

  if (!isObjectSchema(currentSchema)) {
    return <Card tone="caution">Type {valueTypeName} not valid for union</Card>
  }

  const unionTypes = schema.union
  const otherTypes = unionTypes.filter(u => u !== currentSchema)
  return (
    <Stack space={3} marginLeft={2}>
      <Flex>
        <Card padding={1} shadow={1} radius={2}>
          <Flex align="center" gap={2}>
            <Box paddingX={2} flex={1}>
              <Text size={1} weight="semibold">
                {startCase(valueTypeName)}
              </Text>
            </Box>
            <MenuButton
              button={
                <Button mode="bleed" padding={2} icon={EllipsisVerticalIcon} />
              }
              id="menu-button-example"
              menu={
                <Menu>
                  <MenuGroup
                    icon={TransferIcon}
                    popover={NESTED_POPOVER_PROPS}
                    text="Turn into…"
                  >
                    {otherTypes.map(type => {
                      if (isNeverSchema(type)) {
                        return null
                      }
                      const sharedProperties = intersection(
                        Object.keys(type.shape),
                        Object.keys(currentSchema.shape),
                      ).filter(v => v !== '_type')
                      const instanceName = getInstanceName(type)
                      return instanceName ? (
                        <MenuItem
                          key={instanceName}
                          disabled={sharedProperties.length === 0}
                          title={
                            sharedProperties.length === 0
                              ? 'No shared properties'
                              : `Will create a new ${getInstanceName(
                                  type,
                                )} with the following properties carried over from the current value: ${sharedProperties.join(
                                  ', ',
                                )}.`
                          }
                          onClick={() => handleTurnInto(instanceName)}
                          text={startCase(instanceName)}
                        />
                      ) : null
                    })}
                  </MenuGroup>
                  <MenuDivider />
                  <MenuItem
                    icon={TrashIcon}
                    tone="critical"
                    onClick={handleClear}
                    text="Clear"
                  />
                </Menu>
              }
              popover={{portal: true, tone: 'default'}}
            />
          </Flex>
        </Card>
      </Flex>
      <Box>
        <ObjectInput
          schema={currentSchema}
          value={value}
          path={path}
          form={(form.types as any)[valueTypeName!] as any}
          onPatch={handlePatch}
          renderInput={renderInput}
        />
      </Box>
    </Stack>
  )
}

function intersection<T1>(a: T1[], b: T1[]): T1[] {
  return a.filter(x => b.includes(x))
}
