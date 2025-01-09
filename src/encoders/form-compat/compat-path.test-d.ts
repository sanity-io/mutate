import {expectTypeOf, test} from 'vitest'

import {type Path} from '../../path'
import {type CompatPath} from './form-patch-types'

test('compat paths', () => {
  expectTypeOf<Path>().toMatchTypeOf<CompatPath | Readonly<CompatPath>>()
  expectTypeOf<CompatPath>().toMatchTypeOf<Path>()
})
