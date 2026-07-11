import { Outlet } from 'react-router-dom'
import SidebarLogista from './SidebarLogista'

export default function LogistaLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <SidebarLogista />
      <main style={{ flex: 1, padding: 24 }}><Outlet /></main>
    </div>
  )
}
