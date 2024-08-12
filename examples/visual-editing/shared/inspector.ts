import {type InspectionEvent, type Observer} from 'xstate'

export const globalSymbol: symbol = Symbol.for(
  '@statelyai/inspect/example-visual-editing',
)

export type InspectorInspectContextValue =
  | Observer<InspectionEvent>
  | ((inspectionEvent: InspectionEvent) => void)
  | undefined
