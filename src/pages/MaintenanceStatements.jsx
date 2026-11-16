import {useEffect,useState} from 'react'
import {Link,useNavigate} from 'react-router-dom'
import {readCycle,statementAction,migrationMissing} from '../lib/maintenanceCycle'
import {CycleField,CycleError,CycleSetupNotice,CycleStatus,useCycleLanguage} from '../components/CycleFields'
import {statementOwners,projectsForOwner,statementReady,mergeStatementProjects} from '../lib/statementProjects'
import {supabase} from '../lib/supabaseClient'
import '../cycle.css'
export default function MaintenanceStatements(){
 const L=useCycleLanguage(),navigate=useNavigate(),[data,setData]=useState(null),[missing,setMissing]=useState(false),[error,setError]=useState(null),[busy,setBusy]=useState(false),[owner,setOwner]=useState(''),[form,setForm]=useState({project_id:'',period_start:'',period_end:''})
 async function load(){
  setError(null)
  try{
   const org=localStorage.getItem('basmat.active.organization'),cycle=await readCycle(org)
   if(org){
    const results=await Promise.allSettled([
     supabase.rpc('bf35_structure',{p_org:org}),
     supabase.from('bf_clients').select('id,name').eq('organization_id',org),
     supabase.from('bf_contracts').select('id,contract_number').eq('organization_id',org)
    ])
    const value=i=>results[i].status==='fulfilled'&&!results[i].value.error?results[i].value.data:null
    const structure=value(0),owners=value(1),contracts=value(2)
    if(structure&&owners)cycle.projects=mergeStatementProjects(cycle.projects||[],structure.projects||[],owners,contracts||[])
    const failed=results.find(x=>x.status==='rejected'||x.value.error&&x.value.error.code!=='42501')
    if(failed)setError(failed.status==='rejected'?failed.reason:failed.value.error)
   }
   setData(cycle);setMissing(false)
  }catch(e){if(migrationMissing(e))setMissing(true);else setError(e)}
 }
 useEffect(()=>{load()},[])
 const projects=data?.projects||[],owners=statementOwners(projects),ownerProjects=projectsForOwner(projects,owner),selected=ownerProjects.find(p=>p.id===form.project_id),ready=statementReady(selected)
 async function create(e){e.preventDefault();if(busy||!ready)return;setBusy(true);setError(null);try{const id=await statementAction('create',null,form);navigate('/statements/'+id)}catch(e){setError(e)}finally{setBusy(false)}}
 if(missing)return <CycleSetupNotice/>
 return <section className="facility-module"><div className="page-head"><div><h1>{L('مستخلصات أعمال الصيانة','Maintenance work statements')}</h1><p>{L('شهادة إنجاز واحدة لكل بند؛ اعتماد المستخلص يغلق دورة الصيانة المرتبطة.','One completion certificate per line; statement approval closes its maintenance cycles.')}</p></div><button className="btn secondary" onClick={load}>{L('تحديث','Refresh')}</button></div><CycleError error={error}/>
  {data&&<form className="facility-panel" onSubmit={create}>
   <h2>{L('مستخلص جديد','New statement')}</h2>
   <div className="form-grid">
    <CycleField label={L('المالك','Owner')}><select required value={owner} onChange={e=>{setOwner(e.target.value);setForm(f=>({...f,project_id:''}))}}><option value="">{L('اختر المالك','Select owner')}</option>{owners.map(name=><option key={name} value={name}>{name}</option>)}</select></CycleField>
    <CycleField label={L('المشروع','Project')}><select required disabled={!owner} value={form.project_id} onChange={e=>setForm({...form,project_id:e.target.value})}><option value="">{L('اختر المشروع','Select project')}</option>{ownerProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></CycleField>
    <CycleField label={L('بداية الفترة','Period start')}><input type="date" required value={form.period_start} onChange={e=>setForm({...form,period_start:e.target.value})}/></CycleField>
    <CycleField label={L('نهاية الفترة','Period end')}><input type="date" required min={form.period_start} value={form.period_end} onChange={e=>setForm({...form,period_end:e.target.value})}/></CycleField>
   </div>
   {!owners.length&&<p role="status">{L('لا توجد مشاريع مرتبطة بمالك ضمن نطاق وصولك. راجع إسناد المشروع في الملاك والمشاريع.','No owner-linked projects are available within your access scope. Review project access in Owners & Projects.')}</p>}
   {selected&&<div className="cycle-chain"><span>{L('المالك: ','Owner: ')}{selected.owner}</span><span>{L('المشروع: ','Project: ')}{selected.name}</span><span>{L('العقد: ','Contract: ')}{selected.contract||'—'}</span></div>}
   {selected&&!ready&&<div role="status">
    <p>{selected.setup_required?L('المشروع مسجل، لكن إعداد الوصول المالي وسلسلة اعتماده غير مكتمل. أكمل إسناد المستخدمين والصلاحيات لهذا المشروع أولًا.','This project is registered, but its financial access and approval chain are not configured. Complete its user assignments and permissions first.'):selected.policy?.status!=='active'?L('المشروع ظاهر، لكن يلزم إعداد سلسلة الاعتماد وتفعيلها بواسطة ممثل المالك قبل إنشاء المستخلص.','The project is available. Configure its approval chain and have the owner representative activate it before creating a statement.'):L('يلزم أن ينشئ المستخلص مستخدم مخوّل بإدارة مالية هذا المشروع.','A user authorized to manage this project’s finances must create the statement.')}</p>
    {selected.setup_required&&<Link className="btn secondary" to="/project-setup">{L('مراجعة إعداد المشروع والصلاحيات','Review project setup and access')}</Link>}
    {selected.policy?.status!=='active'&&(selected.can_manage||selected.can_activate)&&<Link className="btn secondary" to={'/work-orders?project='+encodeURIComponent(selected.id)+'&tab=setup'}>{L('إعداد اعتماد هذا المشروع','Set up this project’s approval chain')}</Link>}
   </div>}
   <button disabled={busy||!ready} className="btn primary">{L('إنشاء مسودة المستخلص','Create draft statement')}</button>
  </form>}

  <div className="table-wrap"><table><thead><tr>{[L('رقم المستخلص','Statement'),L('المالك','Owner'),L('المشروع','Project'),L('الفترة','Period'),L('الحالة','Status')].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{data?.statements.map(s=><tr key={s.id}><td><Link to={'/statements/'+s.id}>{s.statement_number}</Link></td><td>{data.projects.find(p=>p.id===s.project_id)?.owner||'—'}</td><td>{data.projects.find(p=>p.id===s.project_id)?.name||'—'}</td><td>{s.period_start} — {s.period_end}</td><td><CycleStatus value={s.status}/></td></tr>)}</tbody></table>{data&&!data.statements.length&&<p className="empty">{L('لا توجد مستخلصات ضمن صلاحياتك.','No statements within your access scope.')}</p>}</div><p className="workspace-muted">{L('القيم تمثل قيمة الأعمال المطالب بها بعملة العقد. تكاليف المخزون الداخلية تبقى مستقلة عن قيمة المطالبة.','Values represent claimed work in the contract currency. Internal inventory costs remain separate from claim values.')}</p>
 </section>
}

