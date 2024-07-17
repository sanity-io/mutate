import {studioTheme, ThemeProvider} from '@sanity/ui'
import {type ReactNode} from 'react'

export function Root({children}: {children: ReactNode}) {
  return <ThemeProvider theme={studioTheme}>{children}</ThemeProvider>
}
