import {Link,useLocation} from 'react-router-dom'
import {useAuth} from '../context/AuthContext'
import {useLanguage} from '../i18n/LanguageContext'
import {familyForPath,toolsForPath} from '../config/navigation'
import {moduleLabel} from '../config/modules'

export default function RelatedTools(){
 const {pathname}=useLocation(),{can}=useAuth(),{lang}=useLanguage(),ar=lang==='ar'
 const family=familyForPath(pathname),tools=toolsForPath(pathname,can)
 if(!family||tools.length<2)return null
 const home=tools.find(t=>t.path===family.root)
 const onHome=pathname===family.root
 return <section className="related-tools no-print" aria-label={ar?'أدوات القسم':'Section tools'}>
  {!onHome&&home&&<Link className="related-tools-home" to={home.path}>← {moduleLabel(home,lang)}</Link>}
  <details key={family.root} open={!onHome}>
   <summary>{ar?'أدوات هذا القسم':'Tools in this section'} <span>({tools.filter(t=>t.path!==family.root).length})</span></summary>
   <p>{family[ar?'ar':'en']}</p>
   <div className="related-tools-links">{tools.filter(t=>t.path!==family.root).map(t=><Link key={t.path} to={t.path} aria-current={pathname===t.path?'page':undefined}>{moduleLabel(t,lang)}</Link>)}</div>
  </details>
 </section>
}
