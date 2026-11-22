begin;
-- Allow an explicit draft-plan link while the procedure is still under review.
-- The existing activation and generation checks still require an approved procedure.
do $migration$
declare
  definition text := pg_get_functiondef('public.bf5_action(text,uuid,text,jsonb)'::regprocedure);
  old_clause text := $match$where id=(p_data->>'procedure_id')::uuid and organization_id=org and status='approved';$match$;
  new_clause text := $replace$where id=(p_data->>'procedure_id')::uuid and organization_id=org
     and (status='approved' or (status='draft' and p_data->'allow_draft_procedure'='true'::jsonb));$replace$;
begin
  if strpos(definition,new_clause)>0 then return; end if;
  if (length(definition)-length(replace(definition,old_clause,'')))/length(old_clause)<>1
     or strpos(definition,'Approved procedure required')=0
     or strpos(definition,'Procedure is not approved')=0
     or not exists(
       select 1 from information_schema.columns
       where table_schema='public' and table_name='bf_ppm_plans'
         and column_name='status' and column_default like '''draft''%'
     ) then
    raise exception 'Unexpected PPM procedure or plan definition';
  end if;
  definition:=replace(definition,old_clause,new_clause);
  definition:=replace(definition,'Select an approved procedure','Select a draft or approved procedure');
  execute definition;
end
$migration$;

-- The medical OEM guard still runs on activation and any scheduling update.
do $migration$
declare
  definition text := pg_get_functiondef('public.bamm_v2_oem_guard()'::regprocedure);
  old_clause text := $match$new.status not in('archived','cancelled','closed')$match$;
  new_clause text := $replace$new.status not in('draft','archived','cancelled','closed')$replace$;
begin
  if strpos(definition,new_clause)>0 then return; end if;
  if (length(definition)-length(replace(definition,old_clause,'')))/length(old_clause)<>1
     or strpos(definition,'OEM_INDEPENDENT')=0 or strpos(definition,'bamm_v2_oem_ready(new.procedure_id)')=0 then
    raise exception 'Unexpected medical OEM verification guard';
  end if;
  execute replace(definition,old_clause,new_clause);
end
$migration$;

-- A medical OEM review belongs to an independent reviewer with access to its project.
do $migration$
declare
  definition text := pg_get_functiondef('private.bf12_ppm_setup_items()'::regprocedure);
  old_stage text := $old$when p.status='draft' and step.present then 'ppm_procedure_approve'
        when p.status='draft' and p.created_by=u.id then 'ppm_add_steps'$old$;
  new_stage text := $new$when p.status='draft' and step.present and (
          source.id is null or (source.review_status='pending' and source.created_by<>u.id
            and public.bamm_v2_library_project_access(source.project_id,false)
            and public.bamm_v2_has('ppm.approve'))
        ) then 'ppm_procedure_approve'
        when p.status='draft' and not step.present and p.created_by=u.id then 'ppm_add_steps'$new$;
  old_scope text := 'from actor u cross join public.bf_ppm_procedures p';
  new_scope text := $new$from actor u cross join public.bf_ppm_procedures p
    left join public.bamm_medical_oem_sources source on source.procedure_id=p.id and source.organization_id=p.organization_id$new$;
begin
  if strpos(definition,new_stage)>0 then return; end if;
  if strpos(definition,old_stage)=0 or strpos(definition,old_scope)=0 then
    raise exception 'Unexpected PPM setup notification definition';
  end if;
  execute replace(replace(definition,old_stage,new_stage),old_scope,new_scope);
end
$migration$;

commit;
