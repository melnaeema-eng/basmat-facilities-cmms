import {NavLink,Outlet} from 'react-router-dom'
import {useAuth} from '../context/AuthContext'
import {useLanguage} from '../i18n/LanguageContext'
export default function AppShell(){
 const {signOut,profile,user,can}=useAuth(),{t,lang,setLang}=useLanguage()
 const nav=[['/','dashboard',null],['/organizations','organizations','organizations.view'],['/clients','clients','clients.view'],['/contracts','contracts','contracts.view'],['/sites','sites','sites.view'],['/locations','locations','locations.view'],['/asset-categories','categories','assets.view'],['/assets','assets','assets.view'],['/procurement','procurement','procurement.view'],['/advanced-stock','advancedStock','inventory.view'],['/inventory','inventory','inventory.view'],['/ppm','ppm','ppm.view'],['/corrective','corrective','corrective.view'],['/reports','reports','reports.view'],['/approvals','approvals',null],['/notifications','notifications',null],['/users','usersRoles','users.view']]
 return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">BF</div><div><h2>{t('appName')}</h2><small>Sprint 12 — Notifications</small></div></div>
  <nav className="nav-list">{nav.filter(([, ,permission])=>!permission||can(permission)).map(([to,key])=><NavLink key={to} end={to==='/'} to={to} className={({isActive})=>isActive?'nav-item active':'nav-item'}>{t(key)}</NavLink>)}</nav>
 </aside><div className="main-area"><header className="topbar"><div><strong>{profile?.full_name||user?.email}</strong><div className="muted tiny">{profile?.is_super_admin?t('superAdmin'):''}</div></div><div className="top-actions"><button className="btn secondary" onClick={()=>setLang(lang==='ar'?'en':'ar')}>{t('language')}</button><button className="btn danger-soft" onClick={signOut}>{t('logout')}</button></div></header><main className="content"><Outlet/></main></div></div>
}
