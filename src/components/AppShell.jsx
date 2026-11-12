import NotificationBell from './NotificationBell'
import {NavLink,Outlet,useLocation,useNavigate,Link} from 'react-router-dom'
import {useEffect,useMemo,useRef,useState} from 'react'
import {useAuth} from '../context/AuthContext'
import {useLanguage} from '../i18n/LanguageContext'
import {modules,moduleLabel,permitted} from '../config/modules'
import {supabase} from '../lib/supabaseClient'
import GuidedWorkflowBar from './GuidedWorkflowBar'
import RelatedTools from './RelatedTools'
import {navigationGroups as groups,isNavigableModule,secondaryNavigation,familyForPath} from '../config/navigation'
import '../bafm-theme.css'
import '../workspace.css'
import '../facilities-product.css'
import './AppShellActions.css'
function NavIcon({type}){
 const common={width:17,height:17,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.9,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true}
 const paths={
  home:<><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></>,
  work:<><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
  calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
  building:<><path d="M4 21V5l8-3v19M12 8h8v13M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2"/></>,
  asset:<><path d="M4 7 12 3l8 4-8 4-8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/></>,
  box:<><path d="m3 7 9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/></>,
  cart:<><path d="M3 4h2l2.5 11h9.5l2-7H7"/><circle cx="9" cy="19" r="1"/><circle cx="17" cy="19" r="1"/></>,
  shield:<><path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-4"/></>,
  report:<><path d="M5 3h10l4 4v14H5V3Z"/><path d="M15 3v5h5M8 16v-3M12 16v-6M16 16v-4"/></>,
  chart:<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  users:<><circle cx="9" cy="8" r="3"/><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6"/><circle cx="17" cy="9" r="2"/><path d="M15 15c3 0 5 1.5 6 5"/></>,
  bell:<><path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3V9Z"/><path d="M10 20h4"/></>,
  pin:<><path d="M12 21s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12Z"/><circle cx="12" cy="9" r="2"/></>,
  mobile:<><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 18h4"/></>,
  lock:<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  doc:<><path d="M6 2h8l4 4v16H6V2Z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
  contract:<><path d="M6 2h12v20H6V2Z"/><path d="M9 7h6M9 11h6M9 15h3"/><path d="m13 18 1.5 1.5L18 16"/></>,
  money:<><circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.7-.6-1.7-1-3-1-1.7 0-3 .8-3 2s1.3 1.8 3 2 3 1 3 2.3-1.3 2.2-3 2.2c-1.4 0-2.5-.4-3.3-1.2M12 5v14"/></>,
  check:<><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
  folder:<><path d="M3 6h7l2 2h9v11H3V6Z"/></>,
  tree:<><path d="M12 4v5M6 20v-5h12v5M6 15v-3h12v3M12 9v3"/></>,
  cycle:<><path d="M20 7h-5V2"/><path d="M4 17h5v5"/><path d="M19 12a7 7 0 0 0-12-5l-2 2M5 12a7 7 0 0 0 12 5l2-2"/></>,
 }
 return <svg {...common}>{paths[type]||<><circle cx="12" cy="12" r="8"/><path d="M8 12h8"/></>}</svg>
}

export default function AppShell(){
 const {signOut,profile,user,can,access}=useAuth(),{lang,setLang}=useLanguage(),ar=lang==='ar'
 const location=useLocation(),navigate=useNavigate()
 const [orgRevision,setOrgRevision]=useState(0)
 useEffect(()=>{const refresh=()=>setOrgRevision(v=>v+1);window.addEventListener('basmat-organizations-changed',refresh);return()=>window.removeEventListener('basmat-organizations-changed',refresh)},[])
 const [query,setQuery]=useState(''),[mobileOpen,setMobileOpen]=useState(false),[organizations,setOrganizations]=useState([])
 const [activeOrgId,setActiveOrgId]=useState(()=>localStorage.getItem('basmat.active.organization')||'')
 const [logoutError,setLogoutError]=useState(false),[orgError,setOrgError]=useState(false)
 const content=useRef(null),toggle=useRef(null),platformAdmin=!!access?.super_admin,homeId=access?.home_organization_id||null
 const available=useMemo(()=>modules.filter(m=>permitted(m,can)),[can])
 const extra=secondaryNavigation(can)
 const name=profile?.full_name||user?.email||(ar?'المستخدم':'User')
 useEffect(()=>{let alive=true;async function load(){if(!platformAdmin&&!homeId)return;let q=supabase.from('bf_organizations').select('id,name,name_ar,name_en,code,status,logo_url').neq('status','archived').order('name');if(!platformAdmin)q=q.eq('id',homeId);const {data,error}=await q;if(alive){setOrganizations(data||[]);setOrgError(!!error)}}load();return()=>{alive=false}},[platformAdmin,homeId,orgRevision,location.pathname])
 useEffect(()=>{if(!platformAdmin){setActiveOrgId(homeId||'');if(homeId)localStorage.setItem('basmat.active.organization',homeId);else localStorage.removeItem('basmat.active.organization')}},[platformAdmin,homeId])
 useEffect(()=>{setMobileOpen(false);setQuery('');content.current?.focus()},[location.pathname])
 useEffect(()=>{if(platformAdmin&&!orgError&&organizations.length&&activeOrgId&&!organizations.some(o=>o.id===activeOrgId)){setActiveOrgId('');localStorage.removeItem('basmat.active.organization')}},[platformAdmin,orgError,organizations,activeOrgId])
 useEffect(()=>{if(!mobileOpen)return;const close=e=>{if(e.key==='Escape'){setMobileOpen(false);toggle.current?.focus()}};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[mobileOpen])
 useEffect(()=>{if(!mobileOpen)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[mobileOpen])
 const org=organizations.find(o=>o.id===activeOrgId)
 const orgName=org?(ar?org.name_ar||org.name||org.name_en:org.name_en||org.name||org.name_ar):(ar?'نطاق الصلاحيات المسندة':'Assigned access scope')
 function chooseOrganization(id){setActiveOrgId(id);if(id)localStorage.setItem('basmat.active.organization',id);else localStorage.removeItem('basmat.active.organization');window.dispatchEvent(new CustomEvent('basmat-organization-changed',{detail:{organization_id:id||null}}))}
 async function logout(){setLogoutError(false);try{const result=await signOut();if(result?.error)throw result.error}catch{setLogoutError(true)}}
 function search(e){e.preventDefault();const term=query.trim().toLowerCase();if(!term)return;const hit=available.filter(isNavigableModule).find(m=>[m.ar,m.en].join(' ').toLowerCase().includes(term));if(hit)navigate(hit.path);else navigate('/facility-asset-cockpit',{state:{query}})}
 const item=(m)=><NavLink key={m.path} to={m.path} end={m.path==='/'} className={({isActive})=>'bafm-nav-item '+(isActive||familyForPath(location.pathname)?.root===m.path?'active':'')}><span className="bafm-nav-icon"><NavIcon type={m.icon}/></span><span>{moduleLabel(m,lang)}</span></NavLink>
 return <div className="bafm-shell" dir={ar?'rtl':'ltr'}>
  <a className="bafm-skip" href="#workspace-content">{ar?'انتقل إلى المحتوى':'Skip to content'}</a>
  {mobileOpen&&<button className="bafm-mobile-scrim" onClick={()=>setMobileOpen(false)} aria-label={ar?'إغلاق القائمة':'Close navigation'}/>}
  <aside id="workspace-navigation" className={'bafm-sidebar '+(mobileOpen?'is-open':'')} aria-label={ar?'القائمة الرئيسية':'Main navigation'}>
   <button type="button" className="bafm-drawer-close" onClick={()=>{setMobileOpen(false);toggle.current?.focus()}} aria-label={ar?'إغلاق القائمة':'Close navigation'}>×</button>
   <div className="bafm-logo-block"><div className="dual-brand-row"><Link to="/"><img src="/bafm-logo.png" alt="Basmat Alnawabigh"/></Link>{org?.logo_url&&<div><img src={org.logo_url} alt={orgName} onError={e=>{e.currentTarget.hidden=true}}/><small>{orgName}</small></div>}</div><div className="bafm-logo-word">BAFM</div><div className="bafm-logo-sub">{ar?'بصمة النوابغ · إدارة المرافق':'Basmat Alnawabigh · Facilities'}</div><div className="bafm-logo-tiny">{ar?'نظام إدارة صيانة المرافق والأصول':'FACILITIES & ASSET MAINTENANCE MANAGEMENT SYSTEM'}</div></div>
   <nav className="bafm-nav">{groups.map(g=>{const items=g.paths.map(p=>available.find(m=>m.path===p)).filter(Boolean);return !!items.length&&<section className="bafm-nav-section" key={g.en}><h2 className="bafm-nav-title">{ar?g.ar:g.en}</h2>{items.map(item)}</section>})}
    {!!extra.length&&<section className="bafm-nav-section"><h2 className="bafm-nav-title">{ar?'خدمات إضافية':'Additional services'}</h2>{extra.map(item)}</section>}
   </nav><div className="bafm-sidebar-footer"><button type="button" className="bafm-signout" onClick={logout} aria-label={ar?'تسجيل الخروج':'Sign out'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M9 4H4v16h5M14 7l5 5-5 5M8 12h11"/></svg><span>{ar?'تسجيل الخروج':'Sign out'}</span></button>BAFM · Facilities</div>
  </aside>
  <div className="bafm-main"><header className="bafm-topbar"><button type="button" ref={toggle} className="btn bafm-mobile-toggle" aria-expanded={mobileOpen} aria-controls="workspace-navigation" onClick={()=>setMobileOpen(v=>!v)} aria-label={ar?'فتح القائمة':'Open navigation'}>☰</button><div className="bafm-top-title"><strong>{ar?'بصمة النوابغ لإدارة صيانة المرافق':'Basmat Facilities CMMS'}</strong></div><form className="bafm-search" onSubmit={search}><NavIcon type="report"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={ar?'ابحث في الوحدات والأصول…':'Search modules and assets…'} aria-label={ar?'بحث':'Search'}/></form><div className="bafm-top-actions">{platformAdmin&&organizations.length>0&&<select value={activeOrgId} onChange={e=>chooseOrganization(e.target.value)} aria-label={ar?'شركة الصيانة':'Maintenance company'}><option value="">{ar?'نطاق الصلاحيات المسندة':'Assigned access scope'}</option>{organizations.map(o=><option key={o.id} value={o.id}>{ar?o.name_ar||o.name||o.name_en:o.name_en||o.name||o.name_ar}</option>)}</select>}<button className="bafm-top-btn" onClick={()=>setLang(ar?'en':'ar')}>{ar?'EN':'عربي'}</button>{can('notifications.view')&&<NotificationBell/>}<div className="bafm-user"><span className="bafm-avatar">{name.slice(0,1)}</span><strong>{name}</strong></div><button type="button" className="bafm-signout" onClick={logout} aria-label={ar?'تسجيل الخروج':'Sign out'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M9 4H4v16h5M14 7l5 5-5 5M8 12h11"/></svg><span>{ar?'تسجيل الخروج':'Sign out'}</span></button></div></header>
   <div className="bafm-welcome">{ar?'مرحبًا ':'Welcome '}{name} — {orgName}</div>{(logoutError||orgError)&&<div className="alert error" role="alert">{logoutError?(ar?'تعذر تسجيل الخروج.':'Sign out failed.'):(ar?'تعذر تحميل الشركات.':'Could not load companies.')}</div>}
   <main id="workspace-content" ref={content} tabIndex={-1} className="workspace-content" key={activeOrgId}>{new URLSearchParams(location.search).get('setup')==='1'&&<Link className="workspace-return" to="/project-setup">{ar?'العودة إلى إعداد المشروع':'Back to project setup'}</Link>}<RelatedTools/><GuidedWorkflowBar/><Outlet/></main>
  </div>
 </div>
}
