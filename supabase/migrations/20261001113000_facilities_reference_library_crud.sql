-- BAFM Sprint 4 - Facilities Reference Library CRUD
-- Safe scoped change: only explicit facilities reference tables + two RPCs.
begin;

create or replace function public.bf_ref_library_save(
  p_kind text,
  p_id bigint,
  p_payload jsonb
)
returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id bigint;
  v_code text := upper(trim(coalesce(p_payload->>'code','')));
  v_name_ar text := trim(coalesce(p_payload->>'name_ar',''));
  v_name_en text := nullif(trim(coalesce(p_payload->>'name_en','')),'');
begin
  if auth.uid() is null or not public.bf_is_super_admin() then
    raise exception 'Super Admin only';
  end if;

  if v_code='' or v_name_ar='' then
    raise exception 'Code and Arabic name are required';
  end if;

  if p_kind='owner' then
    if p_id is null then
      insert into public.bf_ref_facility_owners
        (code,name_ar,name_en,category,sector,country_code,status,source_url,source_note)
      values(
        v_code,v_name_ar,v_name_en,
        coalesce(nullif(p_payload->>'category',''),'government_entity'),
        nullif(p_payload->>'sector',''),
        coalesce(nullif(p_payload->>'country_code',''),'SA'),
        'active',
        nullif(p_payload->>'source_url',''),
        nullif(p_payload->>'source_note','')
      )
      returning id into v_id;
    else
      update public.bf_ref_facility_owners
      set code=v_code,
          name_ar=v_name_ar,
          name_en=v_name_en,
          category=coalesce(nullif(p_payload->>'category',''),'government_entity'),
          sector=nullif(p_payload->>'sector',''),
          country_code=coalesce(nullif(p_payload->>'country_code',''),'SA'),
          source_url=nullif(p_payload->>'source_url',''),
          source_note=nullif(p_payload->>'source_note',''),
          updated_at=now()
      where id=p_id
      returning id into v_id;
    end if;

  elsif p_kind='company' then
    if p_id is null then
      insert into public.bf_ref_maintenance_companies
        (code,name_ar,name_en,capabilities,website,status,source_note)
      values(
        v_code,v_name_ar,v_name_en,
        coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'capabilities','[]'::jsonb))), '{}'::text[]),
        nullif(p_payload->>'website',''),
        'active',
        nullif(p_payload->>'source_note','')
      )
      returning id into v_id;
    else
      update public.bf_ref_maintenance_companies
      set code=v_code,
          name_ar=v_name_ar,
          name_en=v_name_en,
          capabilities=coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'capabilities','[]'::jsonb))), '{}'::text[]),
          website=nullif(p_payload->>'website',''),
          source_note=nullif(p_payload->>'source_note',''),
          updated_at=now()
      where id=p_id
      returning id into v_id;
    end if;

  elsif p_kind='type' then
    if p_id is null then
      insert into public.bf_ref_facility_types(code,name_ar,name_en,status)
      values(v_code,v_name_ar,v_name_en,'active')
      returning id into v_id;
    else
      update public.bf_ref_facility_types
      set code=v_code,name_ar=v_name_ar,name_en=v_name_en
      where id=p_id
      returning id into v_id;
    end if;
  else
    raise exception 'Unknown reference kind: %',p_kind;
  end if;

  if v_id is null then
    raise exception 'Reference record not found';
  end if;

  return v_id;
end;
$$;

create or replace function public.bf_ref_library_set_status(
  p_kind text,
  p_id bigint,
  p_status text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null or not public.bf_is_super_admin() then
    raise exception 'Super Admin only';
  end if;

  if p_status not in ('active','archived') then
    raise exception 'Invalid status';
  end if;

  if p_kind='owner' then
    update public.bf_ref_facility_owners
       set status=p_status,updated_at=now()
     where id=p_id;
  elsif p_kind='company' then
    update public.bf_ref_maintenance_companies
       set status=p_status,updated_at=now()
     where id=p_id;
  elsif p_kind='type' then
    update public.bf_ref_facility_types
       set status=p_status
     where id=p_id;
  else
    raise exception 'Unknown reference kind: %',p_kind;
  end if;
end;
$$;

revoke all on function public.bf_ref_library_save(text,bigint,jsonb) from public,anon;
revoke all on function public.bf_ref_library_set_status(text,bigint,text) from public,anon;
grant execute on function public.bf_ref_library_save(text,bigint,jsonb) to authenticated;
grant execute on function public.bf_ref_library_set_status(text,bigint,text) to authenticated;

notify pgrst,'reload schema';
commit;
