-- Guest (signed-out) card-scan quota: 2 lifetime per device, 4 per IP per UTC day.
-- Additive only. Table has RLS on with no policies; access only through the
-- SECURITY DEFINER functions below.
create table if not exists public.guest_scan_quota (
  key text primary key,
  count integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.guest_scan_quota enable row level security;

create or replace function public.claim_guest_scan(
  p_device text, p_ip text, p_device_limit integer default 2, p_ip_limit integer default 4
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  dkey text := 'd:' || left(coalesce(p_device, ''), 64);
  ikey text := 'i:' || left(coalesce(p_ip, ''), 64) || ':' || to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD');
  dcount integer; icount integer;
begin
  if length(coalesce(p_device, '')) < 16 then
    return jsonb_build_object('ok', false, 'reason', 'device', 'used', p_device_limit, 'limit', p_device_limit);
  end if;
  -- serialize per key so concurrent requests cannot both pass
  perform pg_advisory_xact_lock(hashtext(dkey));
  perform pg_advisory_xact_lock(hashtext(ikey));
  select count into dcount from guest_scan_quota where key = dkey;
  select count into icount from guest_scan_quota where key = ikey;
  dcount := coalesce(dcount, 0); icount := coalesce(icount, 0);
  if dcount >= p_device_limit then
    return jsonb_build_object('ok', false, 'reason', 'device', 'used', dcount, 'limit', p_device_limit);
  end if;
  if icount >= p_ip_limit then
    return jsonb_build_object('ok', false, 'reason', 'ip', 'used', dcount, 'limit', p_device_limit);
  end if;
  insert into guest_scan_quota(key, count) values (dkey, 1)
    on conflict (key) do update set count = guest_scan_quota.count + 1, updated_at = now();
  insert into guest_scan_quota(key, count) values (ikey, 1)
    on conflict (key) do update set count = guest_scan_quota.count + 1, updated_at = now();
  return jsonb_build_object('ok', true, 'used', dcount + 1, 'limit', p_device_limit);
end $$;

create or replace function public.guest_scan_status(p_device text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select count from guest_scan_quota where key = 'd:' || left(coalesce(p_device, ''), 64)), 0);
$$;

revoke all on function public.claim_guest_scan(text, text, integer, integer) from public;
revoke all on function public.guest_scan_status(text) from public;
grant execute on function public.claim_guest_scan(text, text, integer, integer) to anon, authenticated, service_role;
grant execute on function public.guest_scan_status(text) to anon, authenticated, service_role;
