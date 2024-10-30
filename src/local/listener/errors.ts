import {type ListenerSequenceState} from './sequentializeListenerEvents'

export class ChannelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChannelError'
  }
}
export class DisconnectError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DisconnectError'
  }
}
export class OutOfSyncError extends Error {
  /**
   * Attach state to the error for debugging/reporting
   */
  state: ListenerSequenceState
  constructor(message: string, state: ListenerSequenceState) {
    super(message)
    this.name = 'OutOfSyncError'
    this.state = state
  }
}

export class DeadlineExceededError extends OutOfSyncError {
  constructor(message: string, state: ListenerSequenceState) {
    super(message, state)
    this.name = 'DeadlineExceededError'
  }
}
export class MaxBufferExceededError extends OutOfSyncError {
  constructor(message: string, state: ListenerSequenceState) {
    super(message, state)
    this.name = 'MaxBufferExceededError'
  }
}
