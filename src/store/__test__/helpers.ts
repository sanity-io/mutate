import {
  catchError,
  lastValueFrom,
  type Observable,
  of,
  tap,
  toArray,
} from 'rxjs'

export type NextEmission<T> = {type: 'next'; value: T}
export type ErrorEmission = {type: 'error'; error: unknown}
export type CompleteEmission = {type: 'complete'}
export type Emission<T> = NextEmission<T> | ErrorEmission | CompleteEmission
export function collectNotifications<T>(observable: Observable<T>) {
  const emissions: Emission<T>[] = []
  const subscription = observable
    .pipe(
      tap({
        next: value => emissions.push({type: 'next', value}),
        error: error => emissions.push({type: 'error', error}),
        complete: () => emissions.push({type: 'complete'}),
      }),
      catchError(error => {
        // console.log(new Date(), 'caught error', error)
        return of(null)
      }),
    )
    .subscribe()

  return {
    emissions,
    unsubscribe: () => subscription?.unsubscribe(),
  }
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function allValuesFrom(observable: Observable<unknown>) {
  return lastValueFrom(observable.pipe(toArray()))
}
