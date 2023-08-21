import {arrify} from '../utils/arrify'
import {applyInIndex} from '../apply'
import type {Mutation, SanityDocument} from '../mutations/types'

type DocumentIndex<Doc> = {[id: string]: Doc}
const empty: DocumentIndex<any> = {}

export const createStore = <Doc extends SanityDocument>(
  initialEntries?: Doc[],
) => {
  let index: DocumentIndex<Doc> =
    initialEntries && initialEntries?.length > 0
      ? initialEntries.reduce((acc, entry) => {
          acc[entry._id] = entry
          return acc
        }, empty)
      : empty

  return {
    // todo: support listening for changes
    entries: () => Object.entries(index),
    get: (id: Doc['_id']) => index[id],
    apply: (mutations: Mutation[] | Mutation) => {
      index = applyInIndex(index, arrify(mutations)) as DocumentIndex<Doc>
    },
  }
}
