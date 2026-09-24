begin;
-- ============================================================
-- V9.2 — Medical Asset Registration & Commissioning
-- Master Library -> Physical Asset -> Tag -> Passport -> PPM
-- ============================================================

create sequence if not exists public.bf_med_asset_tag_seq;
alter table public.bf_med_assets
 add column if not exists project_context_id uuid references public.bf_project_contexts(id),
 add column if not exists owner_client_id uuid references public.bf_clients(id),
 add column if not exists site_id uuid references public.bf_sites(id),
 add column if not exists exact_model text,
 add column if not exists supplier_name text,
 add column if not exists warranty_start_date date,
 add column if not exists commissioning_status text not null default 'registered'
   check(commissioning_status in('registered','inspection_pending','commissioning','ready','rejected')),
 add column if not exists notes text;
create index if not exists bf_med_assets_context
on public.bf_med_assets(organization_id,project_context_id,owner_client_id,site_id,location_node_id);
create or replace function public.bf_med_generate_asset_tag(
 p_org uuid,
 p_location uuid,
 p_type uuid
)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
 n bigint;
 org_code text;
 loc_code text;
 type_code text;
begin
 n:=nextval('public.bf_med_asset_tag_seq');

 select upper(regexp_replace(coalesce(code,'MED'),'[^A-Za-z0-9]','','g'))
 into org_code
 from public.bf_organizations where id=p_org;

 select upper(regexp_replace(coalesce(code,'LOC'),'[^A-Za-z0-9]','','g'))
 into loc_code
 from public.bf_location_nodes where id=p_location;

 select upper(regexp_replace(coalesce(code,'DEV'),'[^A-Za-z0-9]','','g'))
 into type_code
 from public.bf_med_master_types where id=p_type;

 return left(coalesce(org_code,'MED'),8)
   ||'-'||left(coalesce(loc_code,'LOC'),10)
   ||'-'||left(coalesce(type_code,'DEV'),10)
   ||'-'||lpad(n::text,6,'0');
end $$;
create or replace function public.bf_med_register_physical_asset(
 p_org uuid,
 p_project uuid,
 p_owner uuid,
 p_site uuid,
 p_location uuid,
 p_master_type uuid,
 p_manufacturer uuid,
 p_option uuid,
 p_serial text,
 p_exact_model text,
 p_installation_date date,
 p_warranty_start date,
 p_warranty_end date,
 p_supplier text,
 p_criticality text,
 p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 v_id uuid;
 v_tag text;
 v_passport uuid;
 v_passport_code text;
 v_interval integer;
 v_template uuid;
 v_plan_code text;
begin
 if not(
   public.bf_can(p_org,'medical.manage')
   or public.bf_is_super_admin()
 ) then
   raise exception 'Permission denied' using errcode='42501';
 end if;

 if not exists(select 1 from public.bf_med_master_types t where t.id=p_master_type and t.status='active') then
   raise exception 'Medical master type not found or inactive';
 end if;

 if p_manufacturer is not null and not exists(
   select 1 from public.bf_med_manufacturers m where m.id=p_manufacturer and m.status='active'
 ) then
   raise exception 'Medical manufacturer not found or inactive';
 end if;

 if p_location is not null and not exists(
   select 1 from public.bf_location_nodes l where l.id=p_location and l.organization_id=p_org and l.status='active'
 ) then
   raise exception 'Location not found in organization';
 end if;

 if p_project is not null and not exists(
   select 1 from public.bf_project_contexts p
   where p.id=p_project and p.organization_id=p_org
     and p.status='active' and p.maintenance_scope in('medical','both')
 ) then
   raise exception 'Project is not enabled for Medical maintenance';
 end if;

 if nullif(btrim(coalesce(p_serial,'')),'') is null then
   raise exception 'Serial number is required';
 end if;

 if exists(
   select 1 from public.bf_med_assets a
   where a.organization_id=p_org and lower(a.serial_number)=lower(btrim(p_serial))
 ) then
   raise exception 'Serial number already registered in this organization';
 end if;

 v_tag:=public.bf_med_generate_asset_tag(p_org,p_location,p_master_type);

 insert into public.bf_med_assets(
   organization_id,project_context_id,owner_client_id,site_id,location_node_id,
   master_type_id,manufacturer_id,option_id,
   asset_tag,serial_number,model,exact_model,
   operational_status,lifecycle_status,
   installation_date,warranty_start_date,warranty_end_date,
   supplier_name,criticality,commissioning_status,notes
 )
 values(
   p_org,p_project,p_owner,p_site,p_location,
   p_master_type,p_manufacturer,p_option,
   v_tag,btrim(p_serial),nullif(btrim(p_exact_model),''),nullif(btrim(p_exact_model),''),
   'in_service','active',
   p_installation_date,p_warranty_start,p_warranty_end,
   nullif(btrim(p_supplier),''),coalesce(nullif(p_criticality,''),'medium'),'registered',nullif(btrim(p_notes),'')
 )
 returning id into v_id;

 v_passport:=public.bf_ensure_asset_passport(p_org,'medical',v_id);
 select passport_code into v_passport_code from public.bf_asset_passports where id=v_passport;

 -- Resolve preferred maintenance template (model/manufacturer/generic).
 begin
   select public.bf_med_resolve_template(v_id) into v_template;
 exception when others then
   v_template:=null;
 end;

 if v_template is not null then
   select coalesce(interval_months,12)
   into v_interval
   from public.bf_med_master_pm_templates
   where id=v_template;

   v_plan_code:='MPP-'||replace(v_tag,'-','');

   insert into public.bf_med_ppm_plans(
     organization_id,asset_id,template_id,plan_code,interval_months,
     start_date,next_due_date,priority,auto_create_work_order,status,source_type,created_by
   )
   values(
     p_org,v_id,v_template,v_plan_code,coalesce(v_interval,12),
     coalesce(p_installation_date,current_date),
     (coalesce(p_installation_date,current_date)+make_interval(months=>coalesce(v_interval,12)))::date,
     case when p_criticality='critical' then 'critical' when p_criticality='high' then 'high' else 'normal' end,
     true,'active','resolved',auth.uid()
   )
   on conflict do nothing;
 end if;

 insert into public.bf_asset_lifecycle_events(
   organization_id,asset_domain,asset_id,passport_id,event_type,event_title,event_status,
   details,performed_by
 )
 values(
   p_org,'medical',v_id,v_passport,'commissioning',
   'Medical asset registered from master library','registered',
   jsonb_build_object(
     'asset_tag',v_tag,'serial_number',p_serial,'project_context_id',p_project,
     'location_node_id',p_location,'master_type_id',p_master_type,
     'manufacturer_id',p_manufacturer,'template_id',v_template
   ),
   auth.uid()
 );

 return jsonb_build_object(
   'asset_id',v_id,
   'asset_tag',v_tag,
   'passport_id',v_passport,
   'passport_code',v_passport_code,
   'ppm_template_id',v_template,
   'ppm_created',v_template is not null
 );
end $$;
revoke all on function public.bf_med_register_physical_asset(
 uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date,date,text,text,text
) from public,anon;
grant execute on function public.bf_med_register_physical_asset(
 uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date,date,text,text,text
) to authenticated;
notify pgrst,'reload schema';
commit;
