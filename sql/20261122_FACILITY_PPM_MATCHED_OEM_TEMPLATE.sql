begin;

create or replace function public.bf_fac_ppm_matching_oem(p_asset uuid)
returns table(id uuid,title_ar text,title_en text,frequency text,source_document text,source_revision text)
language sql stable security definer set search_path=''
as $$
 select t.id,t.title_ar,t.title_en,t.frequency,t.source_document,t.source_revision
 from public.bf_assets a
 join public.bf_asset_categories c on c.id=a.category_id and c.organization_id=a.organization_id
 join public.bf_master_asset_types ty on (ty.id=c.master_asset_type_id or ty.code=c.code) and ty.status='active'
 join public.bf_master_ppm_templates t on t.asset_type_id=ty.id
 join public.bf_master_manufacturers m on m.id=t.manufacturer_id and m.status='active'
 where a.id=p_asset and a.status='active'
   and exists(select 1 from public.bf_profiles u where u.id=auth.uid() and u.status='active')
   and public.bf_acl_has_permission(a.organization_id,'facilities.ppm.manage',auth.uid())
   and not exists(select 1 from public.bf_med_tenant_assets mta
     where mta.asset_id=a.id and mta.organization_id=a.organization_id and mta.status='active')
   and t.status='active' and t.source_type='oem' and t.frequency_basis='calendar'
   and t.verified_at is not null and t.verified_by is not null
   and nullif(trim(t.source_document),'') is not null and nullif(trim(t.source_revision),'') is not null
   and coalesce(nullif(t.source_url,''),t.reference,'') ~ '^https://'
   and lower(trim(m.name))=lower(trim(a.manufacturer))
   and nullif(trim(t.model_family),'') is not null and lower(trim(t.model_family))=lower(trim(a.model))
   and exists(select 1 from public.bf_master_ppm_steps st where st.template_id=t.id)
 order by t.frequency,t.title_en;
$$;

create or replace function public.bf_fac_ppm_import_oem(p_asset uuid,p_template uuid)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare a public.bf_assets; t public.bf_master_ppm_templates; new_id uuid;
begin
 select * into a from public.bf_assets where id=p_asset for share;
 if not exists(select 1 from public.bf_fac_ppm_matching_oem(p_asset) m where m.id=p_template) then
   raise exception 'No verified manufacturer template matches the selected asset' using errcode='42501';
 end if;

 select * into t from public.bf_master_ppm_templates where id=p_template for share;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.organization_id::text||a.category_id::text||t.id::text,7));
 select id into new_id from public.bf_ppm_procedures p
 where p.organization_id=a.organization_id and p.category_id=a.category_id and p.master_template_id=t.id
   and p.status in ('draft','approved') and lower(p.manufacturer)=lower(a.manufacturer) and lower(p.model)=lower(a.model)
 order by (p.status='approved') desc,p.version desc limit 1;
 if new_id is not null then return new_id; end if;

 new_id:=public.bf5_action('procedure',null,'create',jsonb_build_object(
  'organization_id',a.organization_id,'category_id',a.category_id,'manufacturer',a.manufacturer,'model',a.model,
  'name_ar',t.title_ar,'name_en',t.title_en,'frequency',t.frequency,
  'reference',concat_ws(' / ',t.source_document,t.source_revision,coalesce(nullif(t.source_url,''),t.reference)),
  'estimated_minutes',t.estimated_minutes));
 update public.bf_ppm_procedures set
  source_type=t.source_type,source_name=t.source_name,source_document=t.source_document,
  source_revision=t.source_revision,source_url=coalesce(nullif(t.source_url,''),t.reference),
  master_template_id=t.id,required_skill=t.required_skill,required_personnel=t.required_personnel,
  required_tools=t.required_tools,required_test_equipment=t.required_test_equipment,required_ppe=t.required_ppe,
  required_consumables=t.required_consumables,prerequisites=t.prerequisites,shutdown_required=t.shutdown_required,
  loto_required=t.loto_required,permit_required=t.permit_required,frequency_basis=t.frequency_basis,
  interval_value=t.interval_value,interval_unit=t.interval_unit,meter_type=t.meter_type,meter_interval=t.meter_interval
 where id=new_id;

 insert into public.bf_ppm_steps(procedure_id,seq,title_ar,title_en,instructions_ar,instructions_en,task_type,required,
  response_type,unit,min_value,max_value,safety_notes,tools,materials,reference,
  acceptance_text,photo_required,failure_action,escalation_role,hold_point)
 select new_id,s.seq,s.title_ar,s.title_en,s.instructions_ar,s.instructions_en,s.task_type,s.required,
  s.response_type,s.unit,s.min_value,s.max_value,s.safety_notes,s.tools,s.materials,s.reference,
  s.acceptance_text,s.photo_required,s.failure_action,s.escalation_role,s.hold_point
 from public.bf_master_ppm_steps s where s.template_id=t.id order by s.seq;
 return new_id;
end;
$$;
revoke all on function public.bf_fac_ppm_matching_oem(uuid),public.bf_fac_ppm_import_oem(uuid,uuid) from public,anon;
grant execute on function public.bf_fac_ppm_matching_oem(uuid),public.bf_fac_ppm_import_oem(uuid,uuid) to authenticated;
commit;
