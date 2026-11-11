-- Keep the RPC body, access checks, grants, and result scope unchanged.
-- Bound join-order search while planning the nested authorization queries.
begin;
alter function public.bf44_cycle_center(uuid) set join_collapse_limit = 1;
alter function public.bf44_cycle_center(uuid) set from_collapse_limit = 1;
commit;
