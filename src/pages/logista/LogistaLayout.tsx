import SidebarLogista from './SidebarLogista'

export default function LogistaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <SidebarLogista />
      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  )
}
