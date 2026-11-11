-- User requested continuation through financial closeout on 2026-11-11.
-- Existing finance.manage roles only; exact registered test project; existing expiry unchanged.
-- No organization-wide grants, new roles, inventory rights, or chargeable claims.
begin;
do $extend$
declare definition text; n integer;
begin
 update private.bf48_test_cycle_access g
 set permission_keys=array_append(g.permission_keys,'finance.manage')
 from public.bf35_projects pr join public.bf_contracts co on co.id=pr.contract_id
 where g.project_id=pr.id and g.organization_id=pr.organization_id and g.client_id=pr.client_id and g.contract_id=pr.contract_id
 and pr.project_code='PRJ-000021' and pr.name='TEST ONLY — دورة وقائية وتصحيحية لجهاز مرافق'
 and co.contract_number='TEST-FM-20261108-01' and coalesce((to_jsonb(co)->>'contract_value')::numeric,0)=0
 and g.expires_at>now() and not('finance.manage'=any(g.permission_keys));
 get diagnostics n=row_count;
 if n<>1 then raise exception 'Exactly one current zero-value test grant required';end if;
 select pg_get_functiondef('private.bf48_test_can(uuid,uuid,text,uuid)'::regprocedure) into definition;
 if position('when ''costing.manage''' in definition)>0 or position('when ''corrective.view''' in definition)=0 then raise exception 'Unexpected isolated permission helper';end if;
 execute replace(definition,'when ''corrective.view''','when ''costing.manage'' then array[''finance.manage'']'||chr(10)||' when ''corrective.view''');
 select pg_get_functiondef('public.bf44_my_project_access()'::regprocedure) into definition;
 if position('''approvals.request'']' in definition)=0 then raise exception 'Unexpected discovery helper';end if;
 execute replace(definition,'''approvals.request'']','''approvals.request'',''costing.manage'']');
end $extend$;

create or replace function private.bf51_zero_value_test_line()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.bf44_statements st join private.bf48_test_cycle_access g on g.project_id=st.project_id
  where st.id=new.statement_id and 'finance.manage'=any(g.permission_keys))
 and (new.coverage is distinct from 'included' or coalesce(new.labor,0)<>0 or coalesce(new.parts,0)<>0 or coalesce(new.plant,0)<>0 or coalesce(new.other,0)<>0)
 then raise exception 'Training financial closeout permits included zero-value lines only' using errcode='23514';end if;
 return new;
end $$;
revoke all on function private.bf51_zero_value_test_line() from public,anon,authenticated;
create trigger bf51_zero_value_test_line before insert or update on public.bf44_statement_lines for each row execute function private.bf51_zero_value_test_line();
notify pgrst,'reload schema';
commit;
