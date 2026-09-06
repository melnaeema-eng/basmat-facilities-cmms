import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  ['/', 'Dashboard'],
  ['/organizations', 'Organizations'],
  ['/clients', 'Clients'],
  ['/contracts', 'Contracts'],
  ['/sites', 'Sites'],
  ['/users', 'Users & Roles'],
]

export default function AppShell() {
  return (
    <div style={{display:'grid',gridTemplateColumns:'240px 1fr',minHeight:'100vh',fontFamily:'Arial,sans-serif'}}>
      <aside style={{background:'#152238',color:'#fff',padding:24}}>
        <h2 style={{marginTop:0}}>Basmat Facilities CMMS</h2>
        <p style={{opacity:.75,fontSize:13}}>Sprint 1 — Foundation</p>
        <nav style={{display:'grid',gap:10,marginTop:28}}>
          {navItems.map(([to,label]) => (
            <NavLink
              key={to}
              to={to}
              style={({isActive}) => ({
                color:'#fff',
                textDecoration:'none',
                padding:'10px 12px',
                borderRadius:8,
                background:isActive?'rgba(255,255,255,.14)':'transparent'
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main style={{background:'#f6f7f9'}}>
        <header style={{background:'#fff',padding:'18px 28px',borderBottom:'1px solid #e5e7eb'}}>
          <strong>Basmat Facilities CMMS</strong>
        </header>
        <section style={{padding:28}}>
          <Outlet />
        </section>
      </main>
    </div>
  )
}
