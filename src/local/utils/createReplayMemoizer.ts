import {finalize, type Observable, ReplaySubject, share, timer} from 'rxjs'

export function createReplayMemoizer(expiry: number) {
  const memo: {[key: string]: Observable<any>} = Object.create(null)
  return function memoize<T>(
    key: string,
    observable: Observable<T>,
  ): Observable<T> {
    if (!(key in memo)) {
      memo[key] = observable.pipe(
        finalize(() => {
          delete memo[key]
        }),
        share({
          connector: () => new ReplaySubject(1),
          resetOnRefCountZero: () => timer(expiry),
        }),
      )
    }
    return memo[key]!
  }
}
