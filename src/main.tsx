
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
// Saved panel lists: registers the axios hook that clears them after any change
import './utils/listCache'
// check-login: share repeated checks, never sign out over a temporary failure
import './utils/sessionCheck'
// CSRF token on every API request that changes data
import './utils/csrf'
// Pagination brings the list header back into view
import './utils/paginationScroll'
// Search box, reload button and "Saved … ago" styles for panel lists
import './styles/panel-toolbar.css'

/*
import { StrictMode } from 'react'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
*/

createRoot(document.getElementById("root")!).render(
  <App />
);