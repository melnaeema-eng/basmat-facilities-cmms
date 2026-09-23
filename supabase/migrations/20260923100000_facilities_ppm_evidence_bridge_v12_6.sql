-- Basmat Facilities CMMS - PPM evidence bridge V12.6
-- Idempotent bridge from maintenance execution attachments to legacy PPM evidence.
-- Safe when bf53_ppm_evidence does not exist: trigger returns without writing.

create or replace function public.bf54_sync_execution_attachment_to_ppm_evidence()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  pkg jsonb;
  job_id uuid;
  org_id uuid;
  step_id uuid;
  uploader uuid;
begin
  if to_regclass('public.bf53_ppm_evidence') is null then
    return new;
  end if;

  select to_jsonb(p) into pkg
  from public.bf_maintenance_execution_packages p
  where p.id=new.package_id;

  if pkg is null
     or coalesce(pkg->>'source_job_type','') <> 'facility_ppm'
     or nullif(pkg->>'source_job_id','') is null then
    return new;
  end if;

  job_id := (pkg->>'source_job_id')::uuid;
  org_id := nullif(pkg->>'organization_id','')::uuid;
  uploader := coalesce(nullif(to_jsonb(new)->>'uploaded_by','')::uuid,auth.uid());

  select (s->>'id')::uuid into step_id
  from public.bf_ppm_jobs j
  cross join lateral jsonb_array_elements(coalesce(j.procedure_snapshot->'steps','[]'::jsonb)) s
  where j.id=job_id
    and coalesce((s->>'seq')::int,0)=coalesce((to_jsonb(new)->>'step_seq')::int,0)
  limit 1;

  if step_id is null then return new; end if;

  if not exists(
    select 1
    from public.bf53_ppm_evidence e
    where e.job_id=job_id
      and e.step_id=step_id
      and e.object_path=to_jsonb(new)->>'object_path'
  ) then
    insert into public.bf53_ppm_evidence(
      organization_id,job_id,step_id,uploaded_by,file_name,object_path,mime_type,file_size,caption,status
    ) values(
      org_id,job_id,step_id,uploader,
      coalesce(to_jsonb(new)->>'file_name','evidence'),
      to_jsonb(new)->>'object_path',
      nullif(to_jsonb(new)->>'mime_type',''),
      nullif(to_jsonb(new)->>'size_bytes','')::bigint,
      '',
      'ready'
    );
  end if;

  return new;
end
$$;

do $$
begin
  if to_regclass('public.bf_maintenance_execution_attachments') is not null then
    drop trigger if exists bf54_execution_attachment_ppm_evidence
      on public.bf_maintenance_execution_attachments;

    create trigger bf54_execution_attachment_ppm_evidence
    after insert or update on public.bf_maintenance_execution_attachments
    for each row execute function public.bf54_sync_execution_attachment_to_ppm_evidence();
  end if;
end
$$;

-- Backfill existing PPM execution attachments when both tables exist.
do $$
begin
  if to_regclass('public.bf53_ppm_evidence') is not null
     and to_regclass('public.bf_maintenance_execution_attachments') is not null
     and to_regclass('public.bf_maintenance_execution_packages') is not null then
    execute $q$
      insert into public.bf53_ppm_evidence(
        organization_id,job_id,step_id,uploaded_by,file_name,object_path,mime_type,file_size,caption,status
      )
      select
        nullif(to_jsonb(p)->>'organization_id','')::uuid,
        (to_jsonb(p)->>'source_job_id')::uuid,
        (s->>'id')::uuid,
        coalesce(nullif(to_jsonb(a)->>'uploaded_by','')::uuid,auth.uid()),
        coalesce(to_jsonb(a)->>'file_name','evidence'),
        to_jsonb(a)->>'object_path',
        nullif(to_jsonb(a)->>'mime_type',''),
        nullif(to_jsonb(a)->>'size_bytes','')::bigint,
        '',
        'ready'
      from public.bf_maintenance_execution_attachments a
      join public.bf_maintenance_execution_packages p on p.id=a.package_id
      join public.bf_ppm_jobs j on j.id=(to_jsonb(p)->>'source_job_id')::uuid
      cross join lateral jsonb_array_elements(coalesce(j.procedure_snapshot->'steps','[]'::jsonb)) s
      where coalesce(to_jsonb(p)->>'source_job_type','')='facility_ppm'
        and coalesce((s->>'seq')::int,0)=coalesce((to_jsonb(a)->>'step_seq')::int,0)
        and not exists(
          select 1 from public.bf53_ppm_evidence e
          where e.job_id=(to_jsonb(p)->>'source_job_id')::uuid
            and e.step_id=(s->>'id')::uuid
            and e.object_path=to_jsonb(a)->>'object_path'
        )
    $q$;
  end if;
end
$$;
