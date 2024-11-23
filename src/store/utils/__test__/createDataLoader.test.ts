import {
  concat,
  finalize,
  lastValueFrom,
  map,
  merge,
  mergeMap,
  NEVER,
  of,
  share,
  take,
  takeUntil,
  timer,
  toArray,
} from 'rxjs'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {createDataLoader} from '../createDataLoader'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('DataLoader', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  it('wont fetch if nothing is subscribing when scheduler runs', async () => {
    const onLoad = vi.fn()
    const load = createDataLoader({
      onLoad,
    })
    load('foo').subscribe().unsubscribe()
    load('bar').subscribe().unsubscribe()
    load('foo').subscribe().unsubscribe()
    load('bar').subscribe().unsubscribe()
    await vi.advanceTimersByTimeAsync(10)
    expect(onLoad).not.toHaveBeenCalled()
  })
  it('will collect all sequential arguments within time frame and call onLoad with the batch', async () => {
    const onLoad = vi.fn().mockImplementation((keys: string[]) => of(keys))
    const load = createDataLoader({
      onLoad,
    })
    const values = lastValueFrom(
      concat(load('foo'), load('bar'), load('foo'), load('bar')).pipe(
        toArray(),
      ),
    )
    // because we're concating this will happen over 3 ticks
    vi.advanceTimersToNextFrame()
    vi.advanceTimersToNextFrame()
    vi.advanceTimersToNextFrame()
    expect(await values).toMatchInlineSnapshot(`
      [
        "foo",
        "bar",
        "foo",
        "bar",
      ]
    `)
    expect(onLoad).toHaveBeenCalledTimes(4)
    expect(onLoad.mock.calls).toEqual([
      [['foo']],
      [['bar']],
      [['foo']],
      [['bar']],
    ])
  })
  it('will collect all parallel arguments within time frame and call onLoad with the batch', async () => {
    const onLoad = vi.fn().mockImplementation((keys: string[]) => of(keys))
    const load = createDataLoader({
      onLoad,
    })
    const result = lastValueFrom(
      merge(load('foo'), load('bar'), load('foo'), load('bar')).pipe(toArray()),
    )
    vi.advanceTimersToNextFrame()

    expect(await result).toMatchInlineSnapshot(`
      [
        "foo",
        "bar",
        "foo",
        "bar",
      ]
    `)
    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(onLoad.mock.calls).toEqual([[['foo', 'bar', 'foo', 'bar']]])
  })

  it('will exclude cancelled requests', async () => {
    const onLoad = vi.fn().mockImplementation((keys: string[]) => of(keys))
    const load = createDataLoader({
      onLoad,
      durationSelector: () => timer(10),
    })

    // cancel foo and baz
    const stop = timer(2).pipe(share())

    const result = lastValueFrom(
      merge(
        load('foo').pipe(takeUntil(stop)),
        load('bar'),
        load('baz').pipe(takeUntil(stop)),
      ).pipe(toArray()),
    )
    vi.advanceTimersToNextFrame()
    expect(await result).toEqual(['bar'])
    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(onLoad.mock.calls).toEqual([[['bar']]])
  })

  it('will work for several batches after one another', async () => {
    const onLoad = vi
      .fn()
      .mockImplementation((keys: string[]) => timer(30).pipe(map(() => keys)))
    const load = createDataLoader({
      onLoad,
      durationSelector: () => timer(0),
    })

    const result = lastValueFrom(
      merge(
        timer(0).pipe(mergeMap(() => load('foo'))),
        timer(10).pipe(mergeMap(() => load('bar'))),
        timer(20).pipe(mergeMap(() => load('baz'))),
      ).pipe(toArray()),
    )

    vi.advanceTimersToNextFrame()
    vi.advanceTimersByTime(40)
    expect(await result).toEqual(['foo', 'bar', 'baz'])
    expect(onLoad).toHaveBeenCalledTimes(3)
    expect(onLoad.mock.calls).toEqual([[['foo']], [['bar']], [['baz']]])
  })

  it('supports multiple emissions', async () => {
    const onLoad = vi.fn().mockImplementation((keys: string[]) =>
      timer(0, 2).pipe(
        take(2),
        map(i => keys.map(key => `call #${i}: ${key}`)),
      ),
    )
    const load = createDataLoader({
      onLoad,
      durationSelector: () => timer(0),
    })
    const result = lastValueFrom(
      merge(
        timer(0).pipe(mergeMap(() => load('foo'))),
        timer(20).pipe(mergeMap(() => load('bar'))),
        timer(10).pipe(mergeMap(() => load('baz'))),
      ).pipe(toArray()),
    )

    vi.advanceTimersByTime(40)

    expect(await result).toEqual([
      'call #0: foo',
      'call #1: foo',
      'call #0: baz',
      'call #1: baz',
      'call #0: bar',
      'call #1: bar',
    ])
  })
  it('stops subscription to batch fetcher when last subscriber unsubscribes', async () => {
    let unsubscribeCount = 0
    let callCount = 0

    const onLoad = vi.fn().mockImplementation((keys: string[]) => {
      callCount++
      return NEVER.pipe(
        takeUntil(timer(3000)),
        finalize(() => unsubscribeCount++),
      )
    })

    const load = createDataLoader({
      onLoad,
    })
    const sub1 = load('foo').subscribe()
    const sub2 = load('bar').subscribe()
    const sub3 = load('baz').subscribe()
    await vi.advanceTimersByTimeAsync(10)
    expect(callCount).toBe(1)
    const sub4 = load('baz').subscribe()
    await vi.advanceTimersByTimeAsync(10)
    expect(callCount).toBe(2)
    expect(unsubscribeCount).toBe(0)
    sub1.unsubscribe()
    expect(unsubscribeCount).toBe(0)
    sub2.unsubscribe()
    expect(unsubscribeCount).toBe(0)
    sub3.unsubscribe()
    expect(unsubscribeCount).toBe(1)
    sub4.unsubscribe()
    expect(unsubscribeCount).toBe(2)
  })
})
