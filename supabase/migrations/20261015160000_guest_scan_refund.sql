-- Refund a guest scan when the server's AI call failed. Additive only.
-- Guarded by a server-only secret (sha256 stored here) so the public anon key
-- cannot be used to reset counters.
create table if not exists public.guest_scan_secret (
  id integer primary key default 1 check (id = 1),
  refund_hash text not null
);
alter table public.guest_scan_secret enable row level security;

create or replace function public.refund_guest_scan(p_device text, p_ip text, p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  dkey text := 'd:' || left(coalesce(p_device, ''), 64);
  ikey text := 'i:' || left(coalesce(p_ip, ''), 64) || ':' || to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD');
  h text; dcount integer;
begin
  select refund_hash into h from guest_scan_secret where id = 1;
  if h is null or encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex') <> h then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  update guest_scan_quota set count = greatest(count - 1, 0), updated_at = now() where key = dkey returning count into dcount;
  update guest_scan_quota set count = greatest(count - 1, 0), updated_at = now() where key = ikey;
  return jsonb_build_object('ok', true, 'used', coalesce(dcount, 0));
end $$;

revoke all on function public.refund_guest_scan(text, text, text) from public;
grant execute on function public.refund_guest_scan(text, text, text) to anon, authenticated, service_role;
