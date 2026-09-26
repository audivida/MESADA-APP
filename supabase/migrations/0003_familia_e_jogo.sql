-- Ideias trazidas do goonplay. Esta migração só acrescenta: nada do que já existe muda de sentido.
-- Façanhas (a criança conta algo bom que fez sem ninguém pedir), elogios entre a família,
-- limite de pedidos por prêmio, categorias de tarefa, tarefa mensal e link de ajuda.

alter table public.ledger drop constraint ledger_kind_check;
alter table public.ledger add constraint ledger_kind_check
  check (kind in ('task', 'goal', 'bonus', 'penalty', 'payout', 'reward', 'feat', 'praise'));

-- Tarefas -----------------------------------------------------------------
alter table public.tasks drop constraint tasks_recurrence_check;
alter table public.tasks add constraint tasks_recurrence_check
  check (recurrence in ('once', 'daily', 'weekly', 'monthly'));
alter table public.tasks
  add column category text check (category in ('casa', 'estudos', 'saude', 'cuidados')),
  add column help_url text check (help_url ~ '^https?://'),
  add column month_day smallint check (month_day between 1 and 31);
alter table public.tasks add constraint tasks_monthly_day
  check (recurrence <> 'monthly' or month_day is not null);

-- Prêmios: "1 por semana", "2 por ano"... ----------------------------------
alter table public.rewards
  add column limit_count integer check (limit_count > 0),
  add column limit_period text check (limit_period in ('week', 'month', 'year'));
alter table public.rewards add constraint rewards_limit_pair
  check ((limit_count is null) = (limit_period is null));

-- Façanhas ------------------------------------------------------------------
create table public.feats (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children on delete cascade,
  family_id uuid not null references public.families on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  photo_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  points integer not null default 0 check (points >= 0),
  parent_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- Elogios -------------------------------------------------------------------
create table public.praises (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  child_id uuid not null references public.children on delete cascade,
  from_child_id uuid references public.children on delete set null,
  from_name text not null,
  message text not null check (length(trim(message)) between 1 and 200),
  points integer not null default 0 check (points >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index on public.feats (family_id, status);
create index on public.praises (family_id, status);

alter table public.feats enable row level security;
alter table public.praises enable row level security;

-- Tudo é gravado pelas funções abaixo; o app só lê.
create policy "família vê façanhas" on public.feats for select using (family_id = my_family_id());
create policy "família vê elogios" on public.praises for select using (family_id = my_family_id());

-- Ações ---------------------------------------------------------------------
create function public.submit_feat(p_child_id uuid, p_title text, p_photo_path text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_family uuid := my_family_id();
  v_id uuid;
begin
  if not (is_parent() or my_child_id() = p_child_id) then raise exception 'forbidden'; end if;
  if not exists (select 1 from children where id = p_child_id and family_id = v_family) then raise exception 'forbidden'; end if;
  if p_photo_path is not null and p_photo_path not like v_family::text || '/%' then raise exception 'invalid_photo_path'; end if;
  -- Evita enxurrada: no máximo 5 façanhas esperando os pais.
  if (select count(*) from feats where child_id = p_child_id and status = 'pending') >= 5 then raise exception 'too_many_feats'; end if;
  insert into feats (child_id, family_id, title, photo_path)
  values (p_child_id, v_family, trim(p_title), p_photo_path)
  returning id into v_id;
  return v_id;
end $$;

create function public.review_feat(p_feat_id uuid, p_approve boolean, p_points integer, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare v_f feats;
begin
  if not is_parent() then raise exception 'forbidden'; end if;
  if p_approve and coalesce(p_points, 0) <= 0 then raise exception 'points_required'; end if;
  select * into v_f from feats where id = p_feat_id and family_id = my_family_id() for update;
  if v_f.id is null or v_f.status <> 'pending' then raise exception 'already_reviewed'; end if;
  update feats
     set status = case when p_approve then 'approved' else 'rejected' end,
         points = case when p_approve then p_points else 0 end,
         parent_note = nullif(trim(p_note), ''),
         reviewed_at = now()
   where id = p_feat_id;
  if p_approve then
    insert into ledger (child_id, family_id, points, kind, ref_id, note)
    values (v_f.child_id, v_f.family_id, p_points, 'feat', v_f.id, 'Façanha: ' || v_f.title);
  end if;
end $$;

-- Pais: o elogio já vale (e pode vir com pontos). Irmãos: fica esperando os pais, sem pontos.
create function public.send_praise(p_child_id uuid, p_message text, p_points integer) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_family uuid := my_family_id();
  v_from_child uuid := my_child_id();
  v_name text;
  v_points integer := greatest(coalesce(p_points, 0), 0);
  v_id uuid;
begin
  if v_family is null then raise exception 'forbidden'; end if;
  if not exists (select 1 from children where id = p_child_id and family_id = v_family) then raise exception 'forbidden'; end if;
  if is_parent() then
    select name into v_name from parents where user_id = auth.uid();
    insert into praises (family_id, child_id, from_name, message, points, status, reviewed_at)
    values (v_family, p_child_id, coalesce(nullif(v_name, ''), 'Responsável'), trim(p_message), v_points, 'approved', now())
    returning id into v_id;
    if v_points > 0 then
      insert into ledger (child_id, family_id, points, kind, ref_id, note)
      values (p_child_id, v_family, v_points, 'praise', v_id, 'Elogio de ' || coalesce(nullif(v_name, ''), 'Responsável'));
    end if;
  else
    if v_from_child = p_child_id then raise exception 'self_praise'; end if;
    select name into v_name from children where id = v_from_child;
    insert into praises (family_id, child_id, from_child_id, from_name, message)
    values (v_family, p_child_id, v_from_child, v_name, trim(p_message))
    returning id into v_id;
  end if;
  return v_id;
end $$;

create function public.review_praise(p_praise_id uuid, p_approve boolean, p_points integer) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_p praises;
  v_points integer := case when p_approve then greatest(coalesce(p_points, 0), 0) else 0 end;
begin
  if not is_parent() then raise exception 'forbidden'; end if;
  select * into v_p from praises where id = p_praise_id and family_id = my_family_id() for update;
  if v_p.id is null or v_p.status <> 'pending' then raise exception 'already_reviewed'; end if;
  update praises
     set status = case when p_approve then 'approved' else 'rejected' end, points = v_points, reviewed_at = now()
   where id = p_praise_id;
  if v_points > 0 then
    insert into ledger (child_id, family_id, points, kind, ref_id, note)
    values (v_p.child_id, v_p.family_id, v_points, 'praise', v_p.id, 'Elogio de ' || v_p.from_name);
  end if;
end $$;

-- Pedido de prêmio agora respeita o limite por período (semana começa na segunda, fuso de São Paulo).
create or replace function public.request_redemption(p_reward_id uuid, p_child_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_reward rewards;
  v_since timestamptz;
  v_id uuid;
begin
  if not (is_parent() or my_child_id() = p_child_id) then raise exception 'forbidden'; end if;
  perform 1 from children where id = p_child_id and family_id = my_family_id() for update;
  if not found then raise exception 'forbidden'; end if;
  select * into v_reward from rewards where id = p_reward_id and family_id = my_family_id() and active;
  if v_reward.id is null then raise exception 'reward_not_found'; end if;
  if v_reward.limit_count is not null then
    v_since := date_trunc(v_reward.limit_period, now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
    if (select count(*) from redemptions
         where reward_id = v_reward.id and child_id = p_child_id and status <> 'rejected' and created_at >= v_since)
       >= v_reward.limit_count then
      raise exception 'limit_reached';
    end if;
  end if;
  if available_points(p_child_id) < v_reward.cost_points then raise exception 'not_enough_points'; end if;
  insert into redemptions (reward_id, child_id, family_id, cost_points)
  values (v_reward.id, p_child_id, v_reward.family_id, v_reward.cost_points)
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.submit_feat(uuid, text, text) from anon;
revoke execute on function public.review_feat(uuid, boolean, integer, text) from anon;
revoke execute on function public.send_praise(uuid, text, integer) from anon;
revoke execute on function public.review_praise(uuid, boolean, integer) from anon;
