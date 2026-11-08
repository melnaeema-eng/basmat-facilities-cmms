import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabaseClient'
import {useAuth} from '../context/AuthContext'
import {CycleField,useCycleLanguage} from './CycleFields'

// Administrative, read-only troubleshooting through the caller's existing RLS.
// Never substitutes for the authorization enforced by the operational RPCs.
export default function CycleAccessReadiness(){
 const {user,profile,access}=useAuth(),L=useCycleLanguage()
 const [projects,setProjects]=useState([]),[project,setProject]=useState('')
 const [result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const admin=profile?.is_super_admin||access?.super_admin
 useEffect(()=>{
  if(!admin)return
  let active=true
  const org=localStorage.getItem('basmat.active.organization')
  if(!org){setProjects([]);return}
  supabase.from('bf35_projects').select('id,name,project_code,organization_id').eq('organization_id',org).order('name').then(r=>{
   if(!active)return
   if(r.error)setError(r.error.message);else setProjects(r.data||[])
  })
  return()=>{active=false}
 },[admin])
 if(!admin)return null
 async function inspect(){
  const p=projects.find(x=>x.id===project)
  if(!p||!user)return
  setBusy(true);setError('');setResult(null)
  try{
   const queries=[
    ['membership',supabase.from('bf_acl_user_organizations').select('is_active').eq('user_id',user.id).eq('organization_id',p.organization_id)],
    ['roles',supabase.from('bf_acl_user_roles').select('role_id,is_active,valid_from,valid_until').eq('user_id',user.id).eq('organization_id',p.organization_id)],
    ['assignments',supabase.from('bf_acl_user_projects').select('module_code,site_id,discipline_code,is_active,valid_from,valid_until').eq('user_id',user.id).eq('organization_id',p.organization_id).eq('project_id',p.id)],
    ['bindings',supabase.from('bf_acl_project_organizations').select('relationship_type,module_code,site_id,discipline_code,is_active,valid_from,valid_until').eq('organization_id',p.organization_id).eq('project_id',p.id)],
    ['modules',supabase.from('bf_acl_organization_modules').select('module_code,is_enabled,valid_from,valid_until').eq('organization_id',p.organization_id)],
    ['permissions',supabase.from('bf_acl_organization_permissions').select('permission_key,is_allowed').eq('organization_id',p.organization_id)]
   ]
   const rows=await Promise.all(queries.map(async([name,q])=>{
    const r=await q
    if(r.error)throw new Error(name+': '+r.error.message)
    return [name,r.data||[]]
   }))
   const grant=await supabase.from('bf44_project_grants').select('valid_until,is_active').eq('project_id',p.id).eq('organization_id',p.organization_id)
   setResult({...Object.fromEntries(rows),projectGrant:grant.error?null:(grant.data||[])})
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 const activeNow=row=>row.is_active!==false&&(!row.valid_from||row.valid_from<=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'}))&&(!row.valid_until||row.valid_until>=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'}))
 const scope=row=>activeNow(row)&&['shared','facilities'].includes(row.module_code)&&!row.site_id&&!row.discipline_code
 const checks=result?[
  [L('عضوية الجهة','Organization membership'),result.membership.some(x=>x.is_active)],
  [L('دور مسند ونشط','Active assigned role'),result.roles.some(activeNow)],
  [L('إسناد كامل لهذا المشروع','Whole-project assignment'),result.assignments.some(scope)],
  [L('ربط الجهة بهذا المشروع','Organization bound to this project'),result.bindings.some(scope)],
  [L('وحدة مشتركة أو مرافق مفعلة','Enabled shared or Facilities module'),result.modules.some(x=>activeNow(x)&&x.is_enabled&&['shared','facilities'].includes(x.module_code))],
  [L('صلاحية إدارة المشروع لدى الجهة','Organization permits project management'),result.permissions.some(x=>x.is_allowed&&['contracts.manage','projects.manage'].includes(x.permission_key))],
  [L('صلاحية تشغيل المرافق لدى الجهة','Organization permits Facilities operations'),result.permissions.some(x=>x.is_allowed&&['facilities.work_orders.manage','corrective.manage'].includes(x.permission_key))]
 ]:[]
 return <details className="facility-panel"><summary>{L('فحص جاهزية الوصول — إدارة النظام','Access readiness — platform administration')}</summary>
  <p>{L('فحص للقراءة فقط ضمن صلاحيات الحساب الحالي. لا يمنح أدوارًا ولا يتجاوز الاعتمادات. النتيجة الفارغة قد تعني عدم وجود سجل أو حجبه بسياسة الوصول.','Read-only inspection under the current account permissions. It grants no access and bypasses no approvals. Empty results may mean absent records or records hidden by access policy.')}</p>
  <CycleField label={L('مشروع الإعداد الإداري','Administrative setup project')}><select value={project} onChange={e=>{setProject(e.target.value);setResult(null)}}><option value="">—</option>{projects.map(p=><option key={p.id} value={p.id}>{p.project_code} · {p.name}</option>)}</select></CycleField>
  <button className="btn secondary" disabled={!project||busy} onClick={inspect}>{L('فحص دون تغيير البيانات','Inspect without changing data')}</button>
  {error&&<p role="alert">{error}</p>}
  {result&&<><table><thead><tr><th>{L('المتطلب','Requirement')}</th><th>{L('النتيجة المرئية','Visible result')}</th></tr></thead><tbody>{checks.map(([name,ok])=><tr key={name}><td>{name}</td><td>{ok?L('موجود','Present'):L('غير ظاهر / يحتاج تحقق','Not visible / verify')}</td></tr>)}</tbody></table>
   <p>{L('إذن المشروع المحدود','Scoped project entitlement')}: {result.projectGrant===null?L('غير متاح للفحص','Not available for inspection'):result.projectGrant.map(x=>`${x.is_active?L('نشط حتى','Active until'):L('معطل','Disabled')} ${x.valid_until}`).join(', ')||'—'}</p>
   <p>{L('الوحدات المرئية لدى الجهة','Visible organization modules')}: {result.modules.map(x=>`${x.module_code}: ${x.is_enabled?'enabled':'disabled'}`).join(', ')||'—'}</p>
   <p>{L('صلاحيات الجهة المسموحة المرئية','Visible allowed organization permissions')}: {result.permissions.filter(x=>x.is_allowed).map(x=>x.permission_key).join(', ')||'—'}</p>
  </>}
 </details>
}
