import {StrictMode} from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'
import {Root} from './Root'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Root>
      <App />
    </Root>
  </StrictMode>,
)
