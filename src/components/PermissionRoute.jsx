import {useAuth} from '../context/AuthContext'
import {useLanguage} from '../i18n/LanguageContext'
import {permitted} from '../config/modules'
export default function PermissionRoute({permission,children}){
 const {can}=useAuth(),{lang}=useLanguage()
 if(permitted({permission},can))return children
 return <section className="facility-panel" role="alert"><h1>{lang==='ar'?'الوصول غير متاح':'Access unavailable'}</h1><p>{lang==='ar'?'تحتاج إلى صلاحية مخصصة لهذه الوحدة. تواصل مع مسؤول الصلاحيات.':'This module requires an assigned permission. Contact your access administrator.'}</p></section>
}
