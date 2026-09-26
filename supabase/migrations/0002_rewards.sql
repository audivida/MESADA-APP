-- Loja de prêmios: pais cadastram prêmios, filho pede, pais entregam e os pontos saem.

alter table public.ledger drop constraint ledger_kind_check;
alter table public.ledger add constraint ledger_kind_check
  check (kind in ('task', 'goal', 'bonus', 'penalty', 'payout', 'reward'));

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  title text not null check (length(trim(title)) > 0),
  icon text not null default '🎁',
  cost_points integer not null check (cost_points > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.rewards on delete cascade,
  child_id uuid not null references public.children on delete cascade,
  family_id uuid not null references public.families on delete cascade,
  cost_points integer not null check (cost_points > 0),
  status text not null default 'pending' check (status in ('pending', 'delivered', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index on public.rewards (family_id);
create index on public.redemptions (family_id, status);

alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;

create policy "família vê prêmios" on public.rewards for select using (family_id = my_family_id());
create policy "pais criam prêmios" on public.rewards for insert with check (family_id = my_family_id() and is_parent());
create policy "pais editam prêmios" on public.rewards for update using (family_id = my_family_id() and is_parent());

create policy "família vê pedidos" on public.redemptions for select using (family_id = my_family_id());

-- Saldo livre = extrato - pedidos esperando entrega.
create function public.available_points(p_child_id uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(points) from ledger where child_id = p_child_id), 0)
       - coalesce((select sum(cost_points) from redemptions where child_id = p_child_id and status = 'pending'), 0)
$$;

create function public.request_redemption(p_reward_id uuid, p_child_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_reward rewards;
  v_id uuid;
begin
  if not (is_parent() or my_child_id() = p_child_id) then raise exception 'forbidden'; end if;
  -- Trava o filho para dois pedidos ao mesmo tempo não passarem do saldo.
  perform 1 from children where id = p_child_id and family_id = my_family_id() for update;
  if not found then raise exception 'forbidden'; end if;
  select * into v_reward from rewards where id = p_reward_id and family_id = my_family_id() and active;
  if v_reward.id is null then raise exception 'reward_not_found'; end if;
  if available_points(p_child_id) < v_reward.cost_points then raise exception 'not_enough_points'; end if;
  insert into redemptions (reward_id, child_id, family_id, cost_points)
  values (v_reward.id, p_child_id, v_reward.family_id, v_reward.cost_points)
  returning id into v_id;
  return v_id;
end $$;

create function public.review_redemption(p_redemption_id uuid, p_deliver boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_r redemptions;
  v_title text;
begin
  if not is_parent() then raise exception 'forbidden'; end if;
  select * into v_r from redemptions where id = p_redemption_id and family_id = my_family_id() for update;
  if v_r.id is null or v_r.status <> 'pending' then raise exception 'already_reviewed'; end if;
  update redemptions set status = case when p_deliver then 'delivered' else 'rejected' end, reviewed_at = now()
   where id = p_redemption_id;
  if p_deliver then
    select title into v_title from rewards where id = v_r.reward_id;
    insert into ledger (child_id, family_id, points, kind, ref_id, note)
    values (v_r.child_id, v_r.family_id, -v_r.cost_points, 'reward', v_r.id, 'Prêmio: ' || coalesce(v_title, ''));
  end if;
end $$;

revoke execute on function public.available_points(uuid) from anon;
