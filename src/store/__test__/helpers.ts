import {
  catchError,
  EMPTY,
  lastValueFrom,
  type Observable,
  tap,
  toArray,
} from 'rxjs'

export type NextNotification<T> = {kind: 'NEXT'; value: T}
export type ErrorNotification = {kind: 'ERROR'; error: unknown}
export type CompleteNotification = {kind: 'COMPLETE'}
export type Notification<T> =
  | NextNotification<T>
  | ErrorNotification
  | CompleteNotification

export function collectNotifications<T>(observable: Observable<T>) {
  const notifications: Notification<T>[] = []
  const subscription = observable
    .pipe(
      tap({
        next: value => notifications.push({kind: 'NEXT', value}),
        error: error => notifications.push({kind: 'ERROR', error}),
        complete: () => notifications.push({kind: 'COMPLETE'}),
      }),
      // error notifications are handled above
      catchError(() => EMPTY),
    )
    .subscribe()

  return {
    notifications,
    unsubscribe: () => subscription?.unsubscribe(),
  }
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function allValuesFrom(observable: Observable<unknown>) {
  return lastValueFrom(observable.pipe(toArray()))
}
