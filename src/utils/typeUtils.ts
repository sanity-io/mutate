export type ArrayElement<A> = A extends readonly (infer T)[] ? T : never

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Merges an intersection object type from {"foo": 1} & {"bar": 2} to {"foo": 1, "bar": 1}
 */
export type MergeObject<A> = A extends {[P in infer K]: unknown}
  ? {[Key in K]: A[Key]}
  : A
