import {useEffect,useMemo,useState} from 'react'
import {Link} from 'react-router-dom'
import {useAuth} from '../context/AuthContext'
import {useLanguage} from '../i18n/LanguageContext'
import {loadPPMDirectory,ppmAction} from '../lib/ppm'
import {loadMyExecutionPackages,loadExecutionAttachments,uploadExecutionEvidence,openExecutionEvidence,removeExecutionEvidence} from '../lib/maintenanceExecution'
import {Field,Select,Notice,Status} from './FacilityFields'

const completeStates=['completed','approved','closed']
const activeStates=['in_progress','assigned','scheduled']

export default function GuidedDevicePPM({data,onRefresh}){
 const {can,user}=useAuth(),{lang}=useLanguage()
 const [assetId,setAssetId]=useState('')
 const [procedureId,setProcedureId]=useState('')
 const [jobId,setJobId]=useState('')
 const [directory,setDirectory]=useState([])
 const [assignee,setAssignee]=useState('')
 const [packages,setPackages]=useState([])
 const [attachments,setAttachments]=useState([])
 const [draft,setDraft]=useState({})
 const [file,setFile]=useState(null)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')

 const tr=(ar,en)=>lang==='ar'?ar:en
 const asset=(data?.assets||[]).find(x=>x.id===assetId)
 const procedures=useMemo(()=>{
  if(!asset)return[]
  const norm=v=>(v||'').trim().toLowerCase()
  return (data?.procedures||[]).filter(p=>
   p.organization_id===asset.organization_id&&
   p.status==='approved'&&
   (!p.category_id||p.category_id===asset.category_id)&&
   (!p.manufacturer||norm(p.manufacturer)===norm(asset.manufacturer))&&
   (!p.model||norm(p.model)===norm(asset.model))
  )
 },[data,assetId])

 useEffect(()=>{if(procedureId&&!procedures.some(x=>x.id===procedureId)){setProcedureId('');setJobId('')}},[assetId,procedures,procedureId])

 const plans=useMemo(()=>assetId&&procedureId?(data?.plans||[]).filter(p=>p.asset_id===assetId&&p.procedure_id===procedureId):[],[data,assetId,procedureId])
 const planIds=useMemo(()=>new Set(plans.map(x=>x.id)),[plans])
 const jobs=useMemo(()=>(data?.jobs||[]).filter(j=>planIds.has(j.plan_id)).sort((a,b)=>(b.due_date||'').localeCompare(a.due_date||'')),[data,planIds])

 useEffect(()=>{
  if(jobId&&jobs.some(x=>x.id===jobId))return
  const preferred=jobs.find(x=>activeStates.includes(x.status))||jobs[0]
  setJobId(preferred?.id||'')
 },[jobs,jobId])

 const job=(data?.jobs||[]).find(x=>x.id===jobId)
 const proc=(data?.procedures||[]).find(x=>x.id===procedureId)
 const steps=job?.procedure_snapshot?.steps||((data?.steps||[]).filter(x=>x.procedure_id===procedureId).sort((a,b)=>a.seq-b.seq))
 const results=(data?.results||[]).filter(x=>x.job_id===jobId)
 const resultFor=s=>results.find(r=>r.step_id===s.id)
 const manager=job&&can('ppm.manage',job.organization_id)
 const approver=job&&can('ppm.approve',job.organization_id)
 const executor=job&&can('ppm.execute',job.organization_id)&&job.assigned_to===user?.id
 const activeStep=steps.find(s=>!resultFor(s))
 const pkg=packages.find(p=>p.source_job_type==='facility_ppm'&&p.source_job_id===jobId)

 async function loadAux(){
  try{
   const [people,packs]=await Promise.all([loadPPMDirectory(),loadMyExecutionPackages()])
   setDirectory(people||[]);setPackages(packs||[])
  }catch(e){setError(e.message)}
 }
 useEffect(()=>{loadAux()},[])
 useEffect(()=>{
  if(!pkg){setAttachments([]);return}
  loadExecutionAttachments(pkg.id).then(setAttachments).catch(e=>setError(e.message))
 },[pkg?.id,jobId])

 const stepAttachments=s=>attachments.filter(a=>Number(a.step_seq)===Number(s.seq))
 const field=(s,key)=>draft[s.id]?.[key]??resultFor(s)?.[key]??''
 const setField=(s,key,value)=>setDraft(v=>({...v,[s.id]:{...v[s.id],[key]:value}}))

 async function act(command,payload={}){
  if(!job||busy)return
  setBusy(true);setError('');setSuccess('')
  try{
   await ppmAction('job',job.id,command,payload)
   await onRefresh?.()
   await loadAux()
   setSuccess(tr('تم تحديث مهمة PPM بنجاح.','PPM job updated successfully.'))
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }

 async function saveStep(s){
  const result=field(s,'result')
  if(!result)return setError(tr('اختر نتيجة الخطوة أولاً.','Select a step result first.'))
  setBusy(true);setError('');setSuccess('')
  try{
   if(file){
    let currentPkg=pkg
    if(!currentPkg){
     const packs=await loadMyExecutionPackages()
     currentPkg=(packs||[]).find(p=>p.source_job_type==='facility_ppm'&&p.source_job_id===job.id)
     setPackages(packs||[])
    }
    if(!currentPkg)throw Error(tr('لا توجد حزمة تنفيذ مرتبطة بالمهمة. قم بتعيين الفني ثم بدء المهمة أولاً.','No execution package is linked to this job. Assign the technician and start the job first.'))
    await uploadExecutionEvidence(currentPkg,s.seq,file)
    setFile(null)
   }
   await ppmAction('job',job.id,'result',{
    step_id:s.id,
    result,
    reading:field(s,'reading'),
    comment:field(s,'comment')
   })
   await onRefresh?.()
   const packs=await loadMyExecutionPackages();setPackages(packs||[])
   const current=(packs||[]).find(p=>p.source_job_type==='facility_ppm'&&p.source_job_id===job.id)
   if(current)setAttachments(await loadExecutionAttachments(current.id))
   setSuccess(tr('تم حفظ الخطوة.','Step saved.'))
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }

 async function deletePhoto(a){
  if(!confirm(tr('حذف الصورة؟','Delete this photo?')))return
  setBusy(true);setError('')
  try{await removeExecutionEvidence(a);setAttachments(await loadExecutionAttachments(pkg.id))}
  catch(e){setError(e.message)}finally{setBusy(false)}
 }

 if(!data)return null

 return <div className="facility-panel" style={{marginTop:14}}>
  <div className="page-head" style={{marginBottom:10}}>
   <div>
    <h2 style={{margin:0}}>{tr('تنفيذ PPM الموجّه من الأصل','Guided Asset PPM Execution')}</h2>
    <p className="muted">{tr('اختر الأصل، ثم إجراء الصيانة المعتمد، ثم نفّذ الخطوات بالترتيب مع رفع صور الإثبات.','Choose an asset, its approved maintenance procedure, then execute ordered steps with photo evidence.')}</p>
   </div>
   <Link className="btn secondary" to="/asset-library">{tr('مكتبة الأصول','Asset Library')}</Link>
  </div>

  <Notice error={error} success={success}/>

  <div className="form-grid">
   <Field label={tr('الأصل','Asset')}>
    <Select value={assetId} onChange={v=>{setAssetId(v);setProcedureId('');setJobId('')}} options={[{value:'',label:tr('اختر الأصل','Select asset')},...(data.assets||[]).filter(x=>x.status==='active').map(x=>({value:x.id,label:`${x.asset_tag} · ${lang==='ar'?(x.name_ar||x.name_en):(x.name_en||x.name_ar)}`}))]}/>
   </Field>
   <Field label={tr('إجراء PPM المعتمد','Approved PPM procedure')}>
    <Select value={procedureId} onChange={v=>{setProcedureId(v);setJobId('')}} options={[{value:'',label:tr('اختر الإجراء','Select procedure')},...procedures.map(x=>({value:x.id,label:`${x.code} · ${lang==='ar'?(x.name_ar||x.name_en):(x.name_en||x.name_ar)} · ${x.frequency}`}))]}/>
   </Field>
   <Field label={tr('مهمة PPM','PPM job')}>
    <Select value={jobId} onChange={setJobId} options={[{value:'',label:tr('اختر المهمة','Select job')},...jobs.map(x=>({value:x.id,label:`${x.job_number} · ${x.due_date||''} · ${x.status}`}))]}/>
   </Field>
  </div>

  {assetId&&procedureId&&!jobs.length&&<div className="bafm-error" style={{marginTop:10}}>
   {tr('الإجراء موجود في المكتبة لكنه لا يملك مهمة PPM مولدة لهذا الأصل بعد. أنشئ/فعّل خطة PPM ثم Generate من شاشة PPM.','The library procedure exists, but no generated PPM job exists for this asset yet. Create/activate a PPM plan and Generate it from the PPM screen.')}
  </div>}

  {proc&&<div className="facility-panel" style={{marginTop:12}}>
   <strong>{tr('معاينة الإجراء','Procedure preview')}: {lang==='ar'?(proc.name_ar||proc.name_en):(proc.name_en||proc.name_ar)}</strong>
   <p className="muted">{proc.code} · {proc.frequency} · {steps.length} {tr('خطوة','steps')}</p>
   <ol>{steps.map(s=><li key={s.id} style={{marginBottom:5}}>{s.seq}. {lang==='ar'?(s.title_ar||s.title_en):(s.title_en||s.title_ar)}</li>)}</ol>
  </div>}

  {job&&<div className="facility-panel" style={{marginTop:12}}>
   <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
    <div><strong>{job.job_number}</strong> · <Status value={job.status}/></div>
    <Link to={'/ppm/job/'+job.id}>{tr('التفاصيل الكاملة','Full details')}</Link>
   </div>

   {manager&&['scheduled','assigned'].includes(job.status)&&<div className="form-grid" style={{marginTop:10}}>
    <Field label={tr('تعيين الفني','Assign technician')}>
     <Select value={assignee} onChange={setAssignee} options={[{value:'',label:tr('اختر الفني','Select technician')},...directory.filter(x=>x.organization_id===job.organization_id).map(x=>({value:x.id,label:x.full_name||x.email}))]}/>
    </Field>
    <div className="row-actions" style={{alignItems:'end'}}><button className="btn primary" disabled={busy||!assignee} onClick={()=>act('assign',{user_id:assignee})}>{tr('تعيين','Assign')}</button></div>
   </div>}

   <div className="row-actions" style={{marginTop:10}}>
    {executor&&job.status==='assigned'&&<button className="btn primary" disabled={busy} onClick={()=>act('start')}>{tr('بدء التنفيذ','Start execution')}</button>}
    {executor&&job.status==='in_progress'&&steps.length>0&&steps.every(s=>!!resultFor(s))&&<button className="btn primary" disabled={busy} onClick={()=>act('complete')}>{tr('إكمال PPM','Complete PPM')}</button>}
    {approver&&job.status==='completed'&&<button className="btn primary" disabled={busy} onClick={()=>act('approve')}>{tr('اعتماد','Approve')}</button>}
    {approver&&job.status==='approved'&&<button className="btn primary" disabled={busy} onClick={()=>act('close')}>{tr('إغلاق','Close')}</button>}
   </div>
  </div>}

  {job&&steps.map(s=>{
   const saved=resultFor(s)
   const isActive=job.status==='in_progress'&&activeStep?.id===s.id
   const photos=stepAttachments(s)
   return <div key={s.id} className="facility-panel" style={{marginTop:10,opacity:(!saved&&!isActive&&job.status==='in_progress')?.65:1}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
     <strong>{s.seq}. {lang==='ar'?(s.title_ar||s.title_en):(s.title_en||s.title_ar)}</strong>
     <Status value={saved?.result||(isActive?'in_progress':'not_submitted')}/>
    </div>
    <p>{lang==='ar'?(s.instructions_ar||s.instructions_en):(s.instructions_en||s.instructions_ar)}</p>
    {s.safety_notes&&<p className="muted">⚠ {s.safety_notes}</p>}

    {photos.length>0&&<div style={{margin:'8px 0'}}>{photos.map(a=><span key={a.id} className="asset-brand">
     📷 <button type="button" className="btn xs secondary" onClick={()=>openExecutionEvidence(a)}>{a.file_name||tr('صورة','Photo')}</button>
     {isActive&&<button type="button" className="btn xs danger-soft" onClick={()=>deletePhoto(a)}>×</button>}
    </span>)}</div>}

    {isActive&&executor&&<div className="form-grid">
     <Field label={tr('النتيجة','Result')}><Select value={field(s,'result')} onChange={v=>setField(s,'result',v)} options={[{value:'',label:tr('اختر','Select')},{value:'pass',label:'Pass'},{value:'fail',label:'Fail'},...(!s.required?[{value:'na',label:'N/A'}]:[])]}/></Field>
     {s.response_type==='reading'&&<Field label={tr('القراءة','Reading')}><input type="number" step="any" value={field(s,'reading')} onChange={e=>setField(s,'reading',e.target.value)}/></Field>}
     <Field label={tr('الملاحظة','Comment')}><textarea value={field(s,'comment')} onChange={e=>setField(s,'comment',e.target.value)}/></Field>
     <Field label={tr('صورة الإثبات','Photo evidence')}><input type="file" accept="image/*" capture="environment" onChange={e=>setFile(e.target.files?.[0]||null)}/></Field>
     <div className="row-actions"><button type="button" className="btn primary" disabled={busy||!field(s,'result')} onClick={()=>saveStep(s)}>{tr('حفظ والانتقال للتالي','Save & Next')}</button></div>
    </div>}

    {saved&&<p className="muted">{saved.comment||''}{saved.reading!=null&&saved.reading!==''?` · ${saved.reading} ${s.unit||''}`:''}</p>}
   </div>
  })}
 </div>
}
