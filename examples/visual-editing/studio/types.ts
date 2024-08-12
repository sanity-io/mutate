import {type createBrowserInspector} from '@statelyai/inspect'

export type InspectType =
  | ReturnType<typeof createBrowserInspector>['inspect']
  | undefined
