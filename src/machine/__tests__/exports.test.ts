import {expect, test} from 'vitest'

import * as exports from '../index'

test.each([
  ['applyMutations'],
  ['commit'],
  ['rebase'],
  ['squashDMPStrings'],
  ['squashMutationGroups'],
  ['toTransactions'],
])('%s is not exported', key => {
  expect((exports as Record<string, unknown>)[key]).toBeUndefined()
})
