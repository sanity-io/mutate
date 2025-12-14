import {expect, test} from 'vitest'

import {at, patch} from '../../mutations/creators'
import {set} from '../../mutations/operations/creators'
import {createOptimisticStoreMockBackend} from '../optimistic/backend/createOptimisticStoreMockBackend'
import {createOptimisticStore} from '../optimistic/createOptimisticStore'
import {collectNotifications, sleep} from './helpers'

test('concurrent edits from two clients on different fields are merged', async () => {
  const backend = createOptimisticStoreMockBackend()

  const clientA = createOptimisticStore(backend)
  const clientB = createOptimisticStore(backend)

  const id = 'collab-doc-2'
  const base = {_id: id, _type: 'demo', title: 'Base'}

  // Start listening early (required to observe optimistic changes)
  const aObs = collectNotifications(clientA.listen(id))
  const bObs = collectNotifications(clientB.listen(id))

  // A creates and submits the base doc
  clientA.mutate([{type: 'create', document: base}])
  clientA.submit()

  // Give the listener time to propagate the created document to both clients
  await sleep(60)

  // Both A and B edit different fields concurrently
  clientA.mutate([patch(id, at('title', set('A1')))])
  clientA.mutate([patch(id, at('count', set(1)))])

  // Submit in opposite order to simulate race
  clientB.submit()
  clientA.submit()

  await sleep(150)

  const aLast = aObs.notifications
    .filter(n => n.kind === 'NEXT')
    .map(n => (n as any).value)
    .at(-1)
  const bLast = bObs.notifications
    .filter(n => n.kind === 'NEXT')
    .map(n => (n as any).value)
    .at(-1)

  expect(aLast).toEqual({_id: id, _type: 'demo', title: 'A1', count: 1})
  expect(bLast).toEqual({_id: id, _type: 'demo', title: 'A1', count: 1})

  aObs.unsubscribe()
  bObs.unsubscribe()
})
