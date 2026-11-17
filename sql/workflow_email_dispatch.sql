-- Resend approved by user on 2026-11-17 for Medical and Facilities generic action notices.
-- Store the project legacy anon JWT in Vault as bf_workflow_mail_anon; never commit keys.
-- Deploy bf-workflow-mail with verify_jwt=true plus its internal runner-token authentication.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
do $secret$ begin if not exists(select 1 from vault.secrets where name='bf_workflow_mail_runner') then perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'bf_workflow_mail_runner','Internal CMMS dispatcher authentication');end if;end $secret$;
create or replace function private.bf_mail_token(p_token text)
returns boolean language sql stable security definer set search_path='' as $f$
 select length(p_token)=64 and exists(select 1 from vault.decrypted_secrets where name='bf_workflow_mail_runner' and extensions.digest(decrypted_secret,'sha256')=extensions.digest(p_token,'sha256'));
$f$;
create or replace function public.bf_mail_claim(p_token text,p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path='' set jit=off as $f$
declare e record;result jsonb;begin
 if not coalesce(private.bf_mail_token(p_token),false) then raise exception 'Dispatcher authentication required' using errcode='42501';end if;
 for e in select * from private.bf_mail_events where processed_at is null and attempts<3 order by id limit 20 for update skip locked loop
  begin perform private.bf_mail_expand(e.kind,e.entity);update private.bf_mail_events set processed_at=now(),attempts=attempts+1,last_error=null where id=e.id;
  exception when others then update private.bf_mail_events set attempts=attempts+1,last_error=left(sqlerrm,500) where id=e.id;end;
 end loop;
 update private.bf_mail_outbox q set status='cancelled',lease_until=null where status in('queued','sending') and (lease_until is null or lease_until<now()) and not private.bf_mail_valid(q);
 with selected as(select id from private.bf_mail_outbox where attempts<5 and available_at<=now() and (status='queued' or status='sending' and lease_until<now()) order by created_at limit greatest(1,least(coalesce(p_limit,10),20)) for update skip locked),
 claimed as(update private.bf_mail_outbox q set status='sending',attempts=attempts+1,lease_until=now()+interval '5 minutes',lease_id=gen_random_uuid() from selected s where q.id=s.id returning q.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'lease',q.lease_id,'email',u.email,'title',q.title,'action_ar',q.action_ar,'action_en',q.action_en,'url',q.url)),'[]'::jsonb) into result from claimed q join public.bf_profiles u on u.id=q.recipient;
 return result;
end $f$;
create or replace function public.bf_mail_result(p_token text,p_id uuid,p_lease uuid,p_sent boolean,p_provider text default null,p_error text default null)
returns void language plpgsql security definer set search_path='' as $f$
begin
 if not coalesce(private.bf_mail_token(p_token),false) then raise exception 'Dispatcher authentication required' using errcode='42501';end if;
 update private.bf_mail_outbox set status=case when p_sent then 'sent' when attempts>=5 then 'failed' else 'queued' end,
 sent_at=case when p_sent then now() else null end,provider_id=case when p_sent then left(p_provider,200) else provider_id end,last_error=case when p_sent then null else left(coalesce(p_error,'Transport failed'),500) end,
 available_at=now()+interval '1 minute'*power(3,least(attempts-1,4)),lease_until=null,lease_id=null
 where id=p_id and lease_id=p_lease and status='sending';
end $f$;
revoke all on function public.bf_mail_claim(text,integer),public.bf_mail_result(text,uuid,uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.bf_mail_claim(text,integer),public.bf_mail_result(text,uuid,uuid,boolean,text,text) to service_role;
create or replace function private.bf_mail_tick()
returns void language plpgsql security definer set search_path='' as $f$
declare secret text;anon_key text;begin
 if not exists(select 1 from private.bf_mail_events where processed_at is null and attempts<3) and not exists(select 1 from private.bf_mail_outbox where available_at<=now() and (status='queued' or status='sending' and lease_until<now())) then return;end if;
 select decrypted_secret into strict secret from vault.decrypted_secrets where name='bf_workflow_mail_runner';
 select decrypted_secret into strict anon_key from vault.decrypted_secrets where name='bf_workflow_mail_anon';
 perform net.http_post(url:='https://pxbtwjuerndgmppicumr.supabase.co/functions/v1/bf-workflow-mail',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||anon_key),body:=jsonb_build_object('token',secret),timeout_milliseconds:=20000);
end $f$;
revoke all on function private.bf_mail_tick(),private.bf_mail_token(text) from public,anon,authenticated;
select cron.schedule('bf-workflow-mail','* * * * *','select private.bf_mail_tick();');
