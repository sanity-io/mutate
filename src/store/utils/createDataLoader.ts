import {
  asyncScheduler,
  BehaviorSubject,
  bufferWhen,
  concat,
  defer,
  EMPTY,
  filter,
  map,
  merge,
  mergeMap,
  Observable,
  of,
  scheduled,
  share,
  Subject,
  takeUntil,
  takeWhile,
} from 'rxjs'

type AnyKey = keyof any

const defaultDurationSelector = () => scheduled(of(0), asyncScheduler)

type Request<T> = {key: T; cancelled: boolean}

export function createDataLoader<T, KeyT extends AnyKey>(options: {
  onLoad: (ids: KeyT[]) => Observable<T[]>
  durationSelector?: () => Observable<unknown>
}) {
  const durationSelector = options.durationSelector || defaultDurationSelector

  const requests$ = new BehaviorSubject<Request<KeyT> | undefined>(undefined)
  const unsubscribes$ = new Subject<void>()

  const batchResponses = requests$.pipe(
    filter(req => !!req),
    bufferWhen(durationSelector),
    map(requests => requests.filter(request => !request.cancelled)),
    filter(requests => requests.length > 0),
    mergeMap(requests => {
      const keys = requests.map(request => request.key)

      const responses = options.onLoad(keys).pipe(
        takeUntil(
          unsubscribes$.pipe(
            filter(() => requests.every(request => request.cancelled)),
          ),
        ),
        mergeMap(batchResult =>
          requests.map((request, i) => ({
            type: 'value' as const,
            request,
            response: batchResult[i],
          })),
        ),
      )
      // we need to signal to subscribers that the request batch has ended
      const responseEnds = requests.map(request => ({
        request,
        type: 'complete' as const,
      }))
      return concat(responses, responseEnds)
    }),
    share(),
  )

  return (key: KeyT) => {
    return new Observable<T>(subscriber => {
      const mutableRequestState: Request<KeyT> = {key, cancelled: false}
      const emit = defer(() => {
        requests$.next(mutableRequestState)
        return EMPTY
      })
      const subscription = merge(
        batchResponses.pipe(
          filter(batchResult => batchResult.request === mutableRequestState),
          takeWhile(batchResult => batchResult.type !== 'complete'),
          map(batchResult => batchResult.response),
        ),
        emit,
      ).subscribe(subscriber)

      return () => {
        // note: will not be cancelled in-flight unless the whole batch is cancelled
        mutableRequestState.cancelled = true
        unsubscribes$.next()
        subscription.unsubscribe()
      }
    })
  }
}
