create or replace function private.bf_mail_expand(k text,e uuid)
returns void language plpgsql security definer set search_path='' set jit=off as $f$
declare w public.bf_work_orders;j public.bf_ppm_jobs;a public.bf11_approvals;st public.bf44_statements;pr public.bf35_projects;po public.bf44_policies;r public.bf_service_requests;f public.bf44_workflows;pkg public.bf_maintenance_execution_packages;
 o uuid;c uuid;p uuid;s uuid;assigned uuid;linked uuid;state text;token text;title text;path text;app text:='facilities';perm text;ar text;en text;owner_status text;owner_id uuid;cert boolean;
begin
 if k='policy' then
  select * into po from public.bf44_policies where project_id=e;select * into pr from public.bf35_projects where id=e;
  if po.status='draft' then perform private.bf_mail_enqueue(pr.organization_id,pr.client_id,pr.id,null,k,e,po.status,po.prepared_at::text,'owner.review','تفعيل سلسلة اعتماد المشروع','Activate the project approval chain',pr.name,'/statements','facilities',po.owner_reviewer);
  elsif po.status='active' then perform private.bf_mail_enqueue(pr.organization_id,pr.client_id,pr.id,null,k,e,po.status,po.activated_at::text,'costing.manage','تم تفعيل الاعتماد — إعداد المستخلص وتقديمه','Approval chain activated — prepare and submit the statement',pr.name,'/statements');end if;return;
 elsif k='package' then
  select * into pkg from public.bf_maintenance_execution_packages where id=e;
  if pkg.technician_id is null then return;end if;
  if pkg.status in('assigned','blocked','started','completed') then perform private.bf_mail_enqueue(pkg.organization_id,null,null,null,k,e,pkg.status,pkg.updated_at::text,'assigned.package',case when pkg.status='completed' then 'أكملت الإجراء — استكمل تقرير الصيانة وأرسله للمراجعة' else 'إجراء صيانة مسند إليك — تابع خطوات التنفيذ' end,case when pkg.status='completed' then 'Procedure complete — finish the maintenance report and submit for review' else 'Maintenance procedure assigned — follow the execution steps' end,coalesce(pkg.procedure_name_ar,pkg.procedure_name_en,'Maintenance procedure'),'/technician-execution',case when pkg.domain='medical' then 'medical' else 'facilities' end,pkg.technician_id);end if;return;
 elsif k='statement' then
  select * into st from public.bf44_statements where id=e;select * into pr from public.bf35_projects where id=st.project_id;
  case st.status when 'draft','rejected' then perm:='costing.manage';ar:='إعداد المستخلص وتقديمه للاعتماد';en:='Prepare and submit the maintenance statement';
  when 'consultant_review' then perm:='consultant.review';ar:='مراجعة المستخلص واعتماده أو إعادته';en:='Review and approve or return the statement';
  when 'owner_review' then perm:='owner.review';ar:='اعتماد مستخلص الشركة أو إعادته للتصحيح';en:='Approve the company statement or return it for correction';
  when 'approved' then perm:='';ar:='اعتمد المالك المستخلص واكتمل الإغلاق المالي';en:='The owner approved the statement and financial closeout is complete';else return;end case;
  perform private.bf_mail_enqueue(pr.organization_id,pr.client_id,pr.id,null,k,e,st.status,coalesce(st.submitted_at,st.created_at)::text||coalesce(st.comment,''),perm,ar,en,st.statement_number||' · '||pr.name,'/statements/'||e::text,'facilities',case when st.status='approved' then coalesce(st.submitted_by,st.created_by) else null end,case when st.status in('consultant_review','owner_review') then st.submitted_by else null end);return;
 elsif k='request' then
  select * into r from public.bf_service_requests where id=e;
  if exists(select 1 from public.bf_assets x join public.bf_asset_categories cat on cat.id=x.category_id where x.id=r.asset_id and cat.code like 'MED%') then app:='medical';end if;
  if r.status in('submitted','triaged') then perform private.bf_mail_enqueue(r.organization_id,r.client_id,r.project_id,r.site_id,k,e,r.status,r.reported_at::text,'corrective.manage','بلاغ صيانة يحتاج المراجعة والإسناد','Maintenance request requires review and assignment',r.request_number||' · '||r.title,'/corrective/request/'||e::text,app);end if;return;
 elsif k='document_approval' then select * into a from public.bf11_approvals where id=e;if a.status='approved' then perform private.bf_mail_expand(a.entity_type,a.entity_id);end if;return;
 elsif k='approval' then
  select * into a from public.bf11_approvals where id=e;
  select f1.project_id into p from public.bf44_review_links l join public.bf44_workflows f1 on f1.work_order_id=l.work_order_id and l.revision=f1.revision where l.approval_id=e;
  if a.entity_type='work_order' then select * into w from public.bf_work_orders where id=a.entity_id;else select * into j from public.bf_ppm_jobs where id=a.entity_id;select * into w from public.bf_work_orders where id=j.work_order_id;end if;
  if exists(select 1 from public.bf_assets x join public.bf_asset_categories cat on cat.id=x.category_id where x.id=coalesce(j.asset_id,w.asset_id) and cat.code like 'MED%') then app:='medical';end if;
  path:=case when p is not null then '/maintenance-cycle/'||w.id::text when a.entity_type='ppm_job' then '/ppm/job/'||a.entity_id::text else '/corrective/work_order/'||a.entity_id::text end;if p is not null then app:='facilities';end if;
  if a.status='pending' then perform private.bf_mail_enqueue(a.organization_id,a.client_id,p,a.site_id,k,e,a.status,a.requested_at::text,case when a.reviewer_type='owner' then 'owner.review' else 'consultant.review' end,'مطلوب مراجعتك واعتمادك أو الإعادة للتصحيح','Your review and approval or return is required',a.subject,path,app,null,a.requested_by);
  elsif a.status in('approved','rejected') then
   perform private.bf_mail_enqueue(a.organization_id,a.client_id,p,a.site_id,k,e,a.status,coalesce(a.decided_at,a.requested_at)::text,'',case when a.status='approved' then 'تم قبول الإنجاز — تابع الإجراء التالي' else 'أعيد العمل للتصحيح — راجع ملاحظات المالك' end,case when a.status='approved' then 'Work accepted — follow the next action' else 'Work returned — review the owner comments' end,a.subject,path,app,a.requested_by);
   perform private.bf_mail_expand(a.entity_type,a.entity_id);
  end if;return;
 end if;
 if k='work_order' then
  select id into linked from public.bf_ppm_jobs where work_order_id=e and status not in('closed','cancelled') limit 1;if linked is not null then perform private.bf_mail_expand('ppm_job',linked);return;end if;
  select * into w from public.bf_work_orders where id=e;select user_id into assigned from public.bf_work_order_assignments where work_order_id=e order by assigned_at desc limit 1;
  state:=w.status;o:=w.organization_id;c:=w.client_id;s:=w.site_id;title:=w.work_order_number||' · '||w.title;token:=coalesce(w.updated_at,w.created_at)::text;path:='/corrective/work_order/'||e::text;
 elsif k='ppm_job' then
  select * into j from public.bf_ppm_jobs where id=e;select * into w from public.bf_work_orders where id=j.work_order_id;assigned:=j.assigned_to;state:=j.status;o:=j.organization_id;c:=j.client_id;s:=j.site_id;title:=j.job_number;token:=coalesce(j.approved_at,j.completed_at,j.started_at,j.created_at)::text;path:='/ppm/job/'||e::text;
 else return;end if;
 if o is null then return;end if;select * into f from public.bf44_workflows where work_order_id=w.id;p:=f.project_id;
 if p is null and exists(select 1 from public.bf_assets x join public.bf_asset_categories cat on cat.id=x.category_id where x.id=coalesce(j.asset_id,w.asset_id) and cat.code like 'MED%') then app:='medical';end if;
 if p is null then select status,id into owner_status,owner_id from public.bf11_approvals where entity_type=k and entity_id=e and reviewer_type='owner' order by round desc,requested_at desc limit 1;
 else select a1.status,a1.id into owner_status,owner_id from public.bf44_review_links l join public.bf11_approvals a1 on a1.id=l.approval_id where l.work_order_id=w.id and l.revision=f.revision and a1.reviewer_type='owner' order by a1.round desc,a1.requested_at desc limit 1;end if;
 token:=token||':'||coalesce(owner_id::text,'none')||':'||coalesce(owner_status,'none');
 if state in('draft','scheduled') or state in('assigned','accepted','in_progress') and assigned is null then perm:=case when k='ppm_job' then 'ppm.manage' else 'corrective.manage' end;ar:='إسناد مهمة الصيانة إلى الفني';en:='Assign the maintenance task to a technician';
 elsif state in('assigned','accepted','in_progress') then perm:=case when k='ppm_job' then 'ppm.execute' else 'corrective.execute' end;ar:='مهمة صيانة مسندة إليك — تابع التنفيذ وتسجيل النتائج';en:='Maintenance assigned to you — perform the work and record results';
 elsif state='completed' then perm:=case when k='ppm_job' then 'ppm.approve' when w.approval_status='pending' then 'corrective.approve' else 'corrective.manage' end;ar:='مراجعة التنفيذ الفني وإرساله للمرحلة التالية';en:='Review the technical work and send it to the next stage';
 elsif state='approved' then
  if p is not null then
   if exists(select 1 from public.bf44_review_links l join public.bf11_approvals a1 on a1.id=l.approval_id where l.work_order_id=w.id and l.revision=f.revision and a1.status='pending') then return;end if;
   path:='/maintenance-cycle/'||w.id::text;
   if f.report_id is null then perm:='documents.generate';ar:='تجهيز تقرير الصيانة';en:='Prepare the maintenance report';
   elsif exists(select 1 from public.bf44_certificates where work_order_id=w.id) then perm:='costing.manage';ar:='إدراج شهادة الإنجاز في مستخلص الشركة';en:='Include the completion certificate in the company statement';
   elsif owner_status='approved' then perm:='documents.generate';ar:='إصدار شهادة الإنجاز المعتمدة';en:='Issue the accepted completion certificate';
   else perm:='approvals.request';ar:='إرسال التقرير إلى المراجع المخوّل';en:='Submit the report to the authorized reviewer';end if;
  elsif owner_status='pending' then return;
  elsif owner_status='approved' then
   select exists(select 1 from public.bf13_documents where entity_type='approval' and entity_id=owner_id and document_type='approval_certificate' and status='final') into cert;
   if cert then perm:=case when k='ppm_job' then 'ppm.approve' else 'corrective.approve' end;ar:='إغلاق أمر الصيانة بعد القبول والشهادة';en:='Close maintenance after acceptance and certification';else perm:='documents.generate';ar:='إصدار شهادة الإنجاز بعد قبول المالك';en:='Issue the completion certificate after owner acceptance';end if;
  else perm:='approvals.request';ar:='تجهيز التقرير وإرساله لقبول المالك';en:='Prepare the report and submit for owner acceptance';end if;
 elsif state='closed' then if w.created_by is not null then perform private.bf_mail_enqueue(o,c,p,s,k,e,state,token,'','اكتمل إغلاق عمل الصيانة','Maintenance work has been closed',title,path,app,w.created_by);end if;return;
 else return;end if;
 perform private.bf_mail_enqueue(o,c,p,s,k,e,state,token,perm,ar,en,title,path,app,case when state in('assigned','accepted','in_progress') then assigned else null end);
end $f$;
create or replace function private.bf_mail_capture()
returns trigger language plpgsql security definer set search_path='' as $f$
declare k text:=tg_argv[0];v uuid;begin
 if tg_op='UPDATE' and k<>'assignment' and (to_jsonb(new)->'status') is not distinct from(to_jsonb(old)->'status') and (to_jsonb(new)->'approval_status') is not distinct from(to_jsonb(old)->'approval_status') and (to_jsonb(new)->'assigned_to') is not distinct from(to_jsonb(old)->'assigned_to') and (to_jsonb(new)->'report_id') is not distinct from(to_jsonb(old)->'report_id') and (to_jsonb(new)->'owner_reviewer') is not distinct from(to_jsonb(old)->'owner_reviewer') then return new;end if;
 if k in('assignment','workflow','certificate') then k:='work_order';v:=new.work_order_id;
 elsif k='policy' then v:=new.project_id;
 elsif k='document' then if new.status<>'final' then return new;end if;if new.entity_type='approval' then k:='document_approval';v:=new.entity_id;elsif new.entity_type in('work_order','ppm_job') then k:=new.entity_type;v:=new.entity_id;else return new;end if;
 else v:=new.id;end if;
 insert into private.bf_mail_events(kind,entity) values(k,v);return new;
end $f$;
