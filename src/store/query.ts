import {evaluate, parse} from 'groq-js'
import DataLoader from 'dataloader'
import {difference, pick} from 'lodash'
import type {SanityDocumentBase} from '../mutations/types'
import type {ExprNode} from 'groq-js'

import type {Dataset} from './types'

export function createLoader(
  fetchFromRemote: (ids: string[]) => PromiseLike<SanityDocumentBase[]>,
  dataset: Dataset<SanityDocumentBase>,
) {
  return new DataLoader(async (ids: readonly string[]) => {
    const localIds = Object.keys(dataset)
    const remoteIds = difference(ids, localIds)
    const results = await fetchFromRemote(ids as any[])
    const remoteDocs = Object.fromEntries(
      remoteIds.map(id => [
        id,
        results.find((found: SanityDocumentBase) => found._id === id),
      ]),
    )
    const docs = {
      ...remoteDocs,
      ...pick(dataset, localIds),
    }
    return ids.map(id_1 => docs[id_1])
  })
}

export function query(
  dataset: Dataset<SanityDocumentBase>,
  dataloader: DataLoader<any, any>,
  q: string,
  params?: Record<string, unknown>,
) {
  return queryExpr(dataset, dataloader, parse(q), params)
}

export async function queryExpr(
  dataset: Dataset<SanityDocumentBase>,
  dataloader: DataLoader<any, any>,
  parsedQuery: ExprNode,
  params?: Record<string, unknown>,
) {
  return (
    await evaluate(parsedQuery, {
      params: params,
      dataset: Object.values(dataset),
      dereference: reference => {
        return dataloader.load(reference)
      },
    })
  ).get()
}
