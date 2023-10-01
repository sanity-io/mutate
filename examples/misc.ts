import {
  setIfMissing,
  at,
  createIfNotExists,
  dec,
  inc,
  patch,
  set,
} from '@bjoerge/mutiny'
import {applyOp, applyPatches} from '@bjoerge/mutiny/_unstable_apply'
import type {Mutation} from '@bjoerge/mutiny'

const d = dec(1000)
const f = applyOp(dec(1), 4)

// patch the field 'counter' by incrementing
const p = at(['counter'], inc(1))

const incByOne = inc(1)

const mutations: Mutation[] = [
  createIfNotExists({_id: 'foo', _type: 'example'}),
  patch('foo', at(['counter'], incByOne), {ifRevision: 'xyz'}),
]

// the above, in json
const mutationsRaw: Mutation[] = [
  {type: 'createIfNotExists', document: {_id: 'foo', _type: 'example'}},
  {
    type: 'patch',
    id: 'lol',
    patches: [{path: ['foo', 'bar'], op: {type: 'inc', amount: 1}}],
    options: {ifRevision: 'xyz'},
  },
]

const pa = patch('foo', at('foo.bar', set('ok')))

const s = applyPatches(
  [
    at('foo', set('ok')),
    at('bar', set('2')),
    at('x', setIfMissing({_type: 'test'})),
    at('x', setIfMissing({greeting: 'hello'})),
  ],
  {
    _id: 'foo',
    _type: 'ok',
  },
)
