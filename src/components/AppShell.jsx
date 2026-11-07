import {NavLink,Outlet,useLocation,useNavigate,Link} from 'react-router-dom'
import {useEffect,useMemo,useRef,useState} from 'react'
import {useAuth} from '../context/AuthContext'
import {useLanguage} from '../i18n/LanguageContext'
import {modules,moduleGroups,moduleLabel,moduleForPath,permitted} from '../config/modules'
import {supabase} from '../lib/supabaseClient'
import GuidedWorkflowBar from './GuidedWorkflowBar'
import '../bafm-theme.css'
import '../workspace.css'

export default function AppShell(){
 const {signOut,profile,user,can,access}=useAuth(),{lang,setLang}=useLanguage()
 const location=useLocation(),navigate=useNavigate(),ar=lang==='ar'
 const [query,setQuery]=useState(''),[mobileOpen,setMobileOpen]=useState(false),[organizations,setOrganizations]=useState([])
 const [activeOrgId,setActiveOrgId]=useState(()=>localStorage.getItem('basmat.active.organization')||'')
 const [logoutError,setLogoutError]=useState(false),[orgError,setOrgError]=useState(false)
 const toggle=useRef(null),content=useRef(null)
 const platformAdmin=!!access?.super_admin
 const homeId=access?.home_organization_id||null
 const available=useMemo(()=>modules.filter(m=>m.nav&&permitted(m,can)),[can])
 const matches=available.filter(m=>`${m.en} ${m.ar}`.toLowerCase().includes(query.toLowerCase()))
 const current=moduleForPath(location.pathname)
 const name=profile?.full_name||user?.email|| (ar?'المستخدم':'User')
 useEffect(()=>{
  let alive=true
  async function load(){
   if(!platformAdmin&&!homeId){setOrganizations([]);return}
   let request=supabase.from('bf_organizations').select('id,name,name_ar,name_en,code,status').order('name')
   if(!platformAdmin)request=request.eq('id',homeId)
   const {data,error}=await request
   if(alive){setOrganizations(data||[]);setOrgError(!!error)}
  }
  load();return()=>{alive=false}
 },[platformAdmin,homeId])
 useEffect(()=>{
  if(!platformAdmin){
   setActiveOrgId(homeId||'')
   if(homeId)localStorage.setItem('basmat.active.organization',homeId)
   else localStorage.removeItem('basmat.active.organization')
  }
 },[platformAdmin,homeId])
 useEffect(()=>{setMobileOpen(false);setQuery('');content.current?.focus()},[location.pathname])
 useEffect(()=>{
  if(platformAdmin&&!orgError&&organizations.length&&activeOrgId&&!organizations.some(o=>o.id===activeOrgId)){setActiveOrgId('');localStorage.removeItem('basmat.active.organization')}
 },[platformAdmin,orgError,organizations,activeOrgId])
 useEffect(()=>{
  if(!mobileOpen)return
  function close(e){if(e.key==='Escape'){setMobileOpen(false);toggle.current?.focus()}}
  document.addEventListener('keydown',close)
  return()=>document.removeEventListener('keydown',close)
 },[mobileOpen])
 const org=organizations.find(o=>o.id===activeOrgId)
 const orgName=org?(ar?org.name_ar||org.name||org.name_en:org.name_en||org.name||org.name_ar):(ar?'نطاق الصلاحيات المسندة':'Assigned access scope')
 function chooseOrganization(id){
  setActiveOrgId(id)
  if(id)localStorage.setItem('basmat.active.organization',id)
  else localStorage.removeItem('basmat.active.organization')
  window.dispatchEvent(new CustomEvent('basmat-organization-changed',{detail:{organization_id:id||null}}))
 }
 async function logout(){setLogoutError(false);try{const result=await signOut();if(result?.error)throw result.error}catch{setLogoutError(true)}}
 return <div className="workspace-shell" dir={ar?'rtl':'ltr'}>
  <a className="workspace-skip" href="#workspace-content">{ar?'انتقل إلى المحتوى':'Skip to content'}</a>
  {mobileOpen&&<button className="workspace-scrim" onClick={()=>setMobileOpen(false)} aria-label={ar?'إغلاق القائمة':'Close navigation'}/>}
  <aside id="workspace-navigation" className={'workspace-sidebar '+(mobileOpen?'is-open':'')} aria-label={ar?'التنقل الرئيسي':'Main navigation'}>
   <Link className="workspace-brand" to="/"><span className="workspace-brand-mark">ب</span><div><strong>{ar?'بصمة النوابغ':'Basmat Alnawabigh'}</strong><small>{ar?'إدارة المرافق والصيانة':'Facilities & maintenance'}</small></div></Link>
   <div className="workspace-product">{ar?'مساحة إدارة المرافق':'FACILITIES WORKSPACE'}<span>02</span></div>
   <nav>{moduleGroups.map(([id,en,arabic])=>{
    const items=available.filter(m=>m.group===id)
    if(!items.length)return null
    return <section className="workspace-nav-group" key={id}><h2>{ar?arabic:en}</h2>{items.map(m=><NavLink key={m.path} to={m.path} end={m.path==='/'} className={({isActive})=>'workspace-nav-link '+(isActive||(m.path==='/work-orders'&&['/ppm','/corrective'].some(p=>location.pathname.startsWith(p)))?'active':'')}><span className="workspace-nav-dot"/>{moduleLabel(m,lang)}</NavLink>)}</section>
   })}</nav>
   <div className="workspace-sidebar-foot"><span className="workspace-avatar">{name.slice(0,1)}</span><div><strong>{name}</strong><small>{orgName}</small></div></div>
  </aside>
  <div className="workspace-main">
   <header className="workspace-header">
    <button type="button" ref={toggle} className="workspace-menu" aria-label={ar?'فتح القائمة':'Open navigation'} aria-controls="workspace-navigation" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(!mobileOpen)}>☰</button>
    <div className="workspace-breadcrumb"><Link to="/">{ar?'المرافق':'Facilities'}</Link><span>/</span><strong>{moduleLabel(current,lang)}</strong></div>
    <div className="workspace-header-actions">
     <button type="button" className="workspace-action" onClick={()=>setLang(ar?'en':'ar')} aria-label={ar?'Switch to English':'التبديل إلى العربية'}>{ar?'English':'العربية'}</button>
     {can('notifications.view')&&<Link className="workspace-action" to="/notifications">{ar?'الإشعارات':'Notifications'}</Link>}
     <button type="button" className="workspace-action" onClick={logout}>{ar?'خروج':'Sign out'}</button>
    </div>
   </header>
   <div className="workspace-context">
    <span><i/>{orgName}</span>
    {platformAdmin&&organizations.length>0&&<label>{ar?'المنظمة':'Organization'} <select value={activeOrgId} onChange={e=>chooseOrganization(e.target.value)}><option value="">{ar?'نطاق الصلاحيات المسندة':'Assigned access scope'}</option>{organizations.map(o=><option key={o.id} value={o.id}>{ar?o.name_ar||o.name||o.name_en:o.name_en||o.name||o.name_ar}</option>)}</select></label>}
    <div className="workspace-search-wrap"><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={ar?'ابحث عن وحدة…':'Find a module…'} aria-label={ar?'البحث في الوحدات':'Search modules'}/>{query&&<div className="workspace-search-results">{matches.length?matches.map(m=><button key={m.path} onClick={()=>{navigate(m.path);setQuery('')}}>{moduleLabel(m,lang)}</button>):<p>{ar?'لا توجد وحدة مطابقة':'No matching module'}</p>}</div>}</div>
   </div>
   {(logoutError||orgError)&&<div className="alert error" role="alert">{logoutError?(ar?'تعذر تسجيل الخروج. حاول مجدداً.':'Sign out failed. Please retry.'):(ar?'تعذر تحميل أسماء المنظمات.':'Unable to load organization names.')}</div>}
   <main id="workspace-content" ref={content} tabIndex={-1} className="workspace-content" key={activeOrgId}>
    {new URLSearchParams(location.search).get('setup')==='1'&&<Link className="workspace-return" to="/project-setup">{ar?'العودة إلى إعداد المشروع':'Back to project setup'}</Link>}
    <GuidedWorkflowBar/><Outlet/>
   </main>
   <footer className="workspace-footer"><span>{ar?'بصمة النوابغ · إدارة المرافق':'Basmat Alnawabigh · Facilities management'}</span><span>{ar?'الأصول · الصيانة · الجودة':'Assets · Maintenance · Quality'}</span></footer>
  </div>
 </div>
}
