create function public.bf_fac_company_workspace_directory()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.bf_is_super_admin() then
  raise exception 'Platform administrator required' using errcode='42501';
 end if;
 return coalesce((
  select jsonb_agg(entry.value || jsonb_build_object(
   'logo_url',o.logo_url,
   'company_admin_users',exists(select 1 from public.bf_acl_organization_permissions p
     where p.organization_id=o.id and p.permission_key='users.manage' and p.is_allowed)
  ) order by o.name,o.id)
  from jsonb_array_elements(public.bf36_organization_directory()) entry
  join public.bf_organizations o on o.id=(entry.value->>'id')::uuid
 ),'[]'::jsonb);
end
$$;

create function public.bf_fac_save_company_workspace(p_org uuid,p_identity jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 company uuid:=p_org;
 logo text:=nullif(btrim(p_identity->>'logo_url'),'');
 kind text;
begin
 if auth.uid() is null or not public.bf_is_super_admin() then
  raise exception 'Platform administrator required' using errcode='42501';
 end if;
 if logo is not null and (length(logo)>1400000
    or logo !~* '^(https://[^[:space:]@]+|(data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)|/[^/[:space:]][^[:space:]]*)$') then
  raise exception 'Invalid company logo';
 end if;
 if company is null then
  company:=public.bf36_create_organization(p_identity->>'name_ar',p_identity->>'name_en','maintenance_contractor',
   p_identity->>'registration_no',p_identity->>'vat_no',p_identity->>'email',p_identity->>'phone',
   p_identity->>'city',p_identity->>'address');
  insert into public.bf_acl_organization_modules(organization_id,module_code,is_enabled)
   values(company,'shared',true),(company,'facilities',true)
   on conflict do nothing;
  insert into public.bf_acl_organization_permissions(organization_id,permission_key,is_allowed)
   select company,permission_key,true from public.bf_acl_permissions
   where is_active and module_code in ('shared','facilities') and permission_key not in ('companies.manage','users.manage')
   on conflict do nothing;
 else
  select o.organization_type into kind from public.bf_organizations o where o.id=company for update;
  if not found then raise exception 'Organization not found'; end if;
  perform public.bf36_update_organization(company,p_identity->>'name_ar',p_identity->>'name_en',kind,
   p_identity->>'registration_no',p_identity->>'vat_no',p_identity->>'email',p_identity->>'phone',
   p_identity->>'city',p_identity->>'address');
 end if;
 update public.bf_organizations set logo_url=logo where id=company;
 if jsonb_typeof(p_identity->'company_admin_users')='boolean' then
  insert into public.bf_acl_organization_permissions(organization_id,permission_key,is_allowed)
  values(company,'users.manage',(p_identity->>'company_admin_users')::boolean)
  on conflict(organization_id,permission_key) do update set is_allowed=excluded.is_allowed;
  if (p_identity->>'company_admin_users')::boolean then
   insert into public.bf_acl_organization_permissions(organization_id,permission_key,is_allowed)
   values(company,'users.view',true) on conflict do nothing;
  end if;
 end if;
 return company;
end
$$;
revoke all on function public.bf_fac_company_workspace_directory(),public.bf_fac_save_company_workspace(uuid,jsonb) from public,anon;
grant execute on function public.bf_fac_company_workspace_directory(),public.bf_fac_save_company_workspace(uuid,jsonb) to authenticated;
