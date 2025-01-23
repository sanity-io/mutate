import {NEVER, of, take} from 'rxjs'
import {expect, test} from 'vitest'

import {createMockBackend} from '../mock/createMockBackend'
import {createOptimisticStore2} from '../optimistic/createOptimisticStore2'
import {allValuesFrom} from './helpers'

test('Concurrent mutations and patching', async () => {
  const mockBackend = createMockBackend()

  const store = createOptimisticStore2({
    listen: id => of({type: 'sync', id, document: undefined}),
    submit: () => NEVER,
  })
  await expect(
    allValuesFrom(store.listenEvents('foo').pipe(take(1))),
  ).resolves.toEqual([
    {
      type: 'sync',
      id: 'foo',
      before: {local: undefined, remote: undefined},
      after: {local: undefined, remote: undefined},
      rebasedStage: [],
    },
  ])
})
