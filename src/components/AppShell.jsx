import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'

export default function AppShell() {
  const { signOut, profile, user } = useAuth()
  const { t, lang, setLang } = useLanguage()

  const navItems = [
    ['/', 'dashboard'],
    ['/organizations', 'organizations'],
    ['/clients', 'clients'],
    ['/contracts', 'contracts'],
    ['/sites', 'sites'],
    ['/users', 'usersRoles'],
  ]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">BF</div>
          <div>
            <h2>{t('appName')}</h2>
            <small>{t('sprint')}</small>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map(([to, key]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
              {t(key)}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div>
            <strong>{profile?.full_name || user?.email}</strong>
            <div className="muted tiny">{profile?.is_super_admin ? t('superAdmin') : ''}</div>
          </div>
          <div className="top-actions">
            <button className="btn secondary" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{t('language')}</button>
            <button className="btn danger-soft" onClick={signOut}>{t('logout')}</button>
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  )
}
