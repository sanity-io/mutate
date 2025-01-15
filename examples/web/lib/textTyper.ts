const triggerInputEvent = (
  input: HTMLInputElement | HTMLTextAreaElement,
  nextValue: string,
) => {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    input.constructor.prototype,
    'value',
  )!.set
  nativeInputValueSetter!.call(input, nextValue)
  input.dispatchEvent(new Event('input', {bubbles: true}))
}
function splitIndex(str: string, index: number): [string, string] {
  return [str.substring(0, index), str.substring(index + 1)]
}
export function startTyping(
  input: HTMLInputElement | HTMLTextAreaElement,
  text: string,
  delay: (char: string) => number,
  onEnd: () => void,
) {
  let current = 0

  let timerId = setTimeout(write, 0)

  function write() {
    const cursor = input.selectionStart || 0
    const [before, after] = splitIndex(input.value || '', cursor + 1)
    const char = text[current]

    const nextVal =
      (char === '\b' ? before.slice(0, -1) : before + char) + (after || '')
    triggerInputEvent(input, nextVal)
    current++
    if (current < text.length) {
      timerId = setTimeout(write, delay(char!))
    } else {
      onEnd()
    }
  }

  return () => {
    clearTimeout(timerId)
  }
}
