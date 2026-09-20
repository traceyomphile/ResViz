import { ThemeProvider } from './context/ThemeContext.tsx';
import { createRoot } from 'react-dom/client'
import './theme.css'
import './index.css'
import './design-system.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
)
