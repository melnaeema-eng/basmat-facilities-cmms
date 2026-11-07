import {Navigate,useLocation} from 'react-router-dom'
import {useAuth} from '../context/AuthContext'
import {useLanguage} from '../i18n/LanguageContext'
export default function ProtectedRoute({children}){
 const {user,profile,loading,signOut}=useAuth(),{lang}=useLanguage(),location=useLocation(),ar=lang==='ar'
 if(loading)return <div className="center-screen" role="status">{ar?'جارٍ التحميل…':'Loading…'}</div>
 if(!user)return <Navigate to="/login" state={{from:location.pathname+location.search}} replace/>
 if(profile?.status!=='active')return <div className="center-screen"><section><h1>{ar?'الوصول غير متاح':'Access unavailable'}</h1><p>{ar?'تأكد من تفعيل حسابك وصلاحياته لدى المسؤول.':'Contact your administrator to check account activation and access.'}</p><button className="btn secondary" onClick={signOut}>{ar?'تسجيل الخروج':'Sign out'}</button></section></div>
 return children
}
