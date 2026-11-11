-- Bracket only the trusted nested mirror write. Keep all project/actor/state checks.
begin;
create or replace function public.bf44_ppm_mirror()
returns trigger language plpgsql security definer set search_path='' as $$
declare previous_write text:=current_setting('bf4.authorized_write',true);
begin
 if new.work_order_id is not null and new.status is distinct from old.status then
  perform set_config('bf4.authorized_write','yes',true);
  update public.bf_work_orders set status=case when new.status='scheduled' then 'draft' else new.status end,
   approval_status=case when new.status in('approved','closed') then 'approved' when new.status='completed' then 'pending' else 'not_submitted' end,
   started_at=new.started_at,completed_at=new.completed_at,closed_at=new.closed_at,updated_at=now() where id=new.work_order_id and exists(select 1 from public.bf44_workflows where work_order_id=new.work_order_id);
  perform set_config('bf4.authorized_write',coalesce(previous_write,''),true);
 end if;return new;
exception when others then
 perform set_config('bf4.authorized_write',coalesce(previous_write,''),true);
 raise;
end $$;
commit;
