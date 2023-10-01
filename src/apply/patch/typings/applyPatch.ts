import type {Path} from '../../../path'
import type {
  DecOp,
  IncOp,
  Operation,
  SetIfMissingOp,
  SetOp,
  UnsetOp,
} from '../../../mutations/operations/types'
import type {MergeObject} from '../../../utils/typeUtils'
import type {ApplyOp} from './applyOp'
import type {NodePatch} from '../../../mutations/types'

type PickOrUndef<T, Head> = Head extends keyof T ? T[Head] : undefined

export type SetAtPath<P extends Path, O extends SetOp<any>, Node> = P extends [
  infer Head,
  ...infer Tail,
]
  ? Head extends string
    ? Tail extends []
      ? Head extends keyof Node
        ? MergeObject<
            Omit<Node, Head> & {
              [p in Head]: ApplyOp<O, PickOrUndef<Node, Head>>
            }
          >
        : MergeObject<Node & {[p in Head]: ApplyOp<O, PickOrUndef<Node, Head>>}>
      : Head extends keyof Node
      ? Tail extends Path
        ? MergeObject<
            Omit<Node, Head> & {
              [p in Head]: SetAtPath<Tail, O, PickOrUndef<Node, Head>>
            }
          >
        : Node
      : Node
    : Node
  : Node

export type IncAtPath<P extends Path, O extends IncOp<any>, Node> = P extends [
  infer Head,
  ...infer Tail,
]
  ? Head extends string
    ? Tail extends []
      ? Head extends keyof Node
        ? MergeObject<
            Omit<Node, Head> & {
              [p in Head]: ApplyOp<O, PickOrUndef<Node, Head>>
            }
          >
        : MergeObject<Node & {[p in Head]: ApplyOp<O, PickOrUndef<Node, Head>>}>
      : Head extends keyof Node
      ? Tail extends Path
        ? MergeObject<
            Omit<Node, Head> & {
              [p in Head]: IncAtPath<Tail, O, PickOrUndef<Node, Head>>
            }
          >
        : Node
      : Node
    : Node
  : Node

export type DecAtPath<P extends Path, O extends DecOp<any>, Node> = P extends [
  infer Head,
  ...infer Tail,
]
  ? Head extends string
    ? Tail extends []
      ? Head extends keyof Node
        ? MergeObject<
            Omit<Node, Head> & {
              [p in Head]: ApplyOp<O, PickOrUndef<Node, Head>>
            }
          >
        : MergeObject<Node & {[p in Head]: ApplyOp<O, PickOrUndef<Node, Head>>}>
      : Head extends keyof Node
      ? Tail extends Path
        ? MergeObject<
            Omit<Node, Head> & {
              [p in Head]: DecAtPath<Tail, O, PickOrUndef<Node, Head>>
            }
          >
        : Node
      : Node
    : Node
  : Node

export type SetIfMissingAtPath<
  P extends Path,
  O extends SetIfMissingOp<any>,
  Node,
> = P extends [infer Head, ...infer Tail]
  ? Head extends string
    ? Tail extends []
      ? Head extends keyof Node
        ? MergeObject<
            Omit<Node, Head> & {
              [p in Head]: ApplyOp<O, PickOrUndef<Node, Head>>
            }
          >
        : MergeObject<Node & {[p in Head]: ApplyOp<O, PickOrUndef<Node, Head>>}>
      : Head extends keyof Node
      ? Tail extends Path
        ? MergeObject<
            Omit<Node, Head> & {
              [p in Head]: SetIfMissingAtPath<Tail, O, PickOrUndef<Node, Head>>
            }
          >
        : Node
      : Node
    : Node
  : Node

type UnsetAtPath<P extends Path, O extends UnsetOp, T> = P extends [
  infer Head,
  ...infer Tail,
]
  ? Head extends keyof T
    ? Tail extends []
      ? MergeObject<Omit<T, Head>>
      : Tail extends Path
      ? MergeObject<
          Omit<T, Head> & {
            [p in Head]: UnsetAtPath<Tail, O, PickOrUndef<T, Head>>
          }
        >
      : T
    : T
  : T

export type ApplyInObject<
  P extends Path,
  O extends Operation,
  T,
> = O extends SetOp<any>
  ? SetAtPath<P, O, T>
  : O extends SetIfMissingOp<any>
  ? SetIfMissingAtPath<P, O, T>
  : O extends UnsetOp
  ? UnsetAtPath<P, O, T>
  : O extends IncOp<any>
  ? IncAtPath<P, O, T>
  : O extends DecOp<any>
  ? DecAtPath<P, O, T>
  : T

type ApplyInArray<P extends Path, O extends Operation, T extends any[]> = T // @todo

type ApplyAtPrimitive<P extends Path, O extends Operation, T> = ApplyOp<O, T>

export type ApplyPatches<Patches, Doc> = Patches extends [
  infer Head,
  ...infer Tail,
]
  ? Head extends NodePatch
    ? Tail extends []
      ? ApplyPatch<Head, Doc>
      : Tail extends NodePatch[]
      ? ApplyPatches<Tail, ApplyPatch<Head, Doc>>
      : Doc
    : Doc
  : Doc

export type ApplyPatch<Patch extends NodePatch, Doc> = Patch extends NodePatch<
  infer P,
  infer O
>
  ? ApplyAtPath<P, O, Doc>
  : Doc

export type ApplyAtPath<
  P extends Path,
  O extends Operation,
  T,
> = T extends any[]
  ? ApplyInArray<P, O, T>
  : T extends Record<string, any>
  ? ApplyInObject<P, O, T>
  : ApplyAtPrimitive<P, O, T>
