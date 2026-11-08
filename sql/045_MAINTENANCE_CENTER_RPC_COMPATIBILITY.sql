-- MANUAL ONLY: run in the Facilities Supabase SQL editor, not Medical or Sader.
-- Repair the observed PostgREST collision between bf44_center(uuid) and
-- bf44_center(uuid,uuid,uuid,integer). No operational data is read or changed.
begin;
do $$
begin
 if to_regprocedure('public.bf44_cycle_center(uuid)') is null then
  if to_regprocedure('public.bf44_center(uuid)') is null then
   raise exception 'Install integrated maintenance SQL 044 first: bf44_center(uuid) is missing';
  end if;
  -- Rename the exact single-argument implementation. Its OID, body, owner,
  -- security settings and dependencies remain intact. Do not drop overloads.
  alter function public.bf44_center(uuid) rename to bf44_cycle_center;
 end if;
end $$;
revoke all on function public.bf44_cycle_center(uuid) from public,anon;
grant execute on function public.bf44_cycle_center(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
