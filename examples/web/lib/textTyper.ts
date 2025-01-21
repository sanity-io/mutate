const typeCharacter = (
  input: HTMLInputElement | HTMLTextAreaElement,
  char: string,
  position: number,
) => {
  const ev = new InputEvent('change', {
    bubbles: true,
    cancelable: false,
  })
  input.setRangeText(char, position ?? 1, position ?? 0, 'end')
  input.dispatchEvent(ev)
}

export function startTyping(
  input: HTMLInputElement | HTMLTextAreaElement,
  text: string,
  delay: (char: string) => number,
  onEnd: () => void,
) {
  let charIdx = 0
  let insertIdx = input.selectionStart ?? 0

  let timerId = setTimeout(write, 0)

  function write() {
    const char = text[charIdx]
    typeCharacter(input, char || '', insertIdx++)
    charIdx++
    if (charIdx < text.length) {
      timerId = setTimeout(write, delay(char!))
    } else {
      onEnd()
    }
  }
  return () => {
    clearTimeout(timerId)
  }
}
