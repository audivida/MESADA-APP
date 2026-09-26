-- Minha Mesada: esquema inicial.
-- Rode no SQL Editor do Supabase (ou com `supabase db push`).
-- Pais entram com e-mail e senha. Filhos entram com login anônimo + código da família + PIN.

create extension if not exists pgcrypto;

-- Famílias ---------------------------------------------------------------
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  point_value_cents integer not null default 10 check (point_value_cents > 0),
  code text not null unique,
  created_at timestamptz not null default now()
);

create table public.parents (
  user_id uuid primary key references auth.users on delete cascade,
  family_id uuid references public.families on delete set null,
  name text not null,
  consent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  name text not null check (length(trim(name)) > 0),
  birthdate date,
  avatar text not null default '🙂',
  pin_hash text not null,
  created_at timestamptz not null default now()
);

-- Liga uma sessão anônima (aparelho do filho) a um filho.
create table public.child_sessions (
  user_id uuid primary key references auth.users on delete cascade,
  child_id uuid not null references public.children on delete cascade,
  created_at timestamptz not null default now()
);

-- Tarefas e execuções ---------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  points integer not null check (points > 0),
  recurrence text not null check (recurrence in ('once', 'daily', 'weekly')),
  weekdays smallint[] not null default '{}',
  child_ids uuid[] not null default '{}',
  requires_photo boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.executions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks on delete cascade,
  child_id uuid not null references public.children on delete cascade,
  family_id uuid not null references public.families on delete cascade,
  for_date date not null,
  photo_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  parent_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
-- Um envio aberto (pendente ou aprovado) por tarefa, filho e dia.
create unique index executions_one_open_per_day
  on public.executions (task_id, child_id, for_date)
  where status <> 'rejected';

-- Extrato de pontos: o saldo é a soma.
create table public.ledger (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children on delete cascade,
  family_id uuid not null references public.families on delete cascade,
  points integer not null,
  kind text not null check (kind in ('task', 'goal', 'bonus', 'penalty', 'payout')),
  ref_id uuid,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children on delete cascade,
  family_id uuid not null references public.families on delete cascade,
  title text not null,
  target_points integer not null check (target_points > 0),
  bonus_points integer not null default 0 check (bonus_points >= 0),
  achieved_at timestamptz,
  created_at timestamptz not null default now()
);

create index on public.children (family_id);
create index on public.tasks (family_id);
create index on public.executions (family_id, status);
create index on public.ledger (family_id, child_id);
create index on public.goals (family_id);

-- Quem é quem ------------------------------------------------------------
create function public.my_family_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select family_id from parents where user_id = auth.uid()),
    (select c.family_id from child_sessions s join children c on c.id = s.child_id where s.user_id = auth.uid())
  )
$$;

create function public.my_child_id() returns uuid
language sql stable security definer set search_path = public as $$
  select child_id from child_sessions where user_id = auth.uid()
$$;

create function public.is_parent() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from parents where user_id = auth.uid() and family_id is not null)
$$;

-- Segurança por linha ----------------------------------------------------
alter table public.families enable row level security;
alter table public.parents enable row level security;
alter table public.children enable row level security;
alter table public.child_sessions enable row level security;
alter table public.tasks enable row level security;
alter table public.executions enable row level security;
alter table public.ledger enable row level security;
alter table public.goals enable row level security;

create policy "ver a própria família" on public.families for select using (id = my_family_id());
create policy "pais editam a família" on public.families for update using (id = my_family_id() and is_parent());

create policy "ver o próprio cadastro" on public.parents for select using (user_id = auth.uid());
create policy "criar o próprio cadastro" on public.parents for insert with check (user_id = auth.uid() and family_id is null);

create policy "família vê os filhos" on public.children for select using (family_id = my_family_id());
create policy "pais removem filhos" on public.children for delete using (family_id = my_family_id() and is_parent());

create policy "família vê tarefas" on public.tasks for select using (family_id = my_family_id());
create policy "pais criam tarefas" on public.tasks for insert with check (family_id = my_family_id() and is_parent());
create policy "pais editam tarefas" on public.tasks for update using (family_id = my_family_id() and is_parent());

create policy "família vê execuções" on public.executions for select using (family_id = my_family_id());

create policy "família vê extrato" on public.ledger for select using (family_id = my_family_id());
create policy "pais lançam bônus e pagamentos" on public.ledger for insert
  with check (family_id = my_family_id() and is_parent() and kind in ('bonus', 'penalty', 'payout') and ref_id is null
              and exists (select 1 from children c where c.id = child_id and c.family_id = my_family_id()));

create policy "família vê metas" on public.goals for select using (family_id = my_family_id());
create policy "pais criam metas" on public.goals for insert with check (family_id = my_family_id() and is_parent() and achieved_at is null
              and exists (select 1 from children c where c.id = child_id and c.family_id = my_family_id()));
create policy "pais removem metas" on public.goals for delete using (family_id = my_family_id() and is_parent());

-- O hash do PIN nunca é lido pelo app: só as outras colunas ficam visíveis.
revoke select on public.children from anon, authenticated;
grant select (id, family_id, name, birthdate, avatar, created_at) on public.children to authenticated;

-- Ações (RPC) ------------------------------------------------------------
create function public.create_family(p_name text, p_point_value_cents integer) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
  v_code text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from parents where user_id = auth.uid() and family_id is not null) then
    raise exception 'already_has_family';
  end if;
  loop
    v_code := upper(substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=0O1Il', ''), 1, 6));
    exit when length(v_code) = 6 and not exists (select 1 from families where code = v_code);
  end loop;
  insert into families (name, point_value_cents, code) values (p_name, p_point_value_cents, v_code) returning id into v_id;
  update parents set family_id = v_id, consent_at = coalesce(consent_at, now()) where user_id = auth.uid();
  if not found then raise exception 'parent_profile_missing'; end if;
  return v_id;
end $$;

create function public.add_child(p_name text, p_birthdate date, p_avatar text, p_pin text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if not is_parent() then raise exception 'forbidden'; end if;
  if p_pin !~ '^\d{4}$' then raise exception 'invalid_pin'; end if;
  if exists (select 1 from children where family_id = my_family_id() and pin_hash = crypt(p_pin, pin_hash)) then
    raise exception 'pin_in_use';
  end if;
  insert into children (family_id, name, birthdate, avatar, pin_hash)
  values (my_family_id(), p_name, p_birthdate, coalesce(nullif(p_avatar, ''), '🙂'), crypt(p_pin, gen_salt('bf')))
  returning id into v_id;
  return v_id;
end $$;

-- Chamado pelo aparelho do filho depois do login anônimo.
create function public.child_sign_in(p_code text, p_pin text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_child uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select c.id into v_child
    from children c join families f on f.id = c.family_id
   where f.code = upper(trim(p_code)) and c.pin_hash = crypt(trim(p_pin), c.pin_hash)
   limit 1;
  if v_child is null then raise exception 'invalid_code_or_pin'; end if;
  insert into child_sessions (user_id, child_id) values (auth.uid(), v_child)
  on conflict (user_id) do update set child_id = excluded.child_id;
  return v_child;
end $$;

create function public.submit_execution(p_task_id uuid, p_child_id uuid, p_for_date date, p_photo_path text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_task tasks;
  v_id uuid;
begin
  select * into v_task from tasks where id = p_task_id and family_id = my_family_id() and active;
  if v_task.id is null then raise exception 'task_not_found'; end if;
  if not (is_parent() or my_child_id() = p_child_id) then raise exception 'forbidden'; end if;
  if not exists (select 1 from children where id = p_child_id and family_id = v_task.family_id) then raise exception 'forbidden'; end if;
  if v_task.requires_photo and p_photo_path is null then raise exception 'photo_required'; end if;
  if p_photo_path is not null and p_photo_path not like v_task.family_id::text || '/%' then raise exception 'invalid_photo_path'; end if;
  insert into executions (task_id, child_id, family_id, for_date, photo_path)
  values (p_task_id, p_child_id, v_task.family_id, p_for_date, p_photo_path)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'already_submitted';
end $$;

-- Aprovar ou recusar, e lançar os pontos na mesma transação.
create function public.review_execution(p_execution_id uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ex executions;
  v_task tasks;
begin
  if not is_parent() then raise exception 'forbidden'; end if;
  select * into v_ex from executions where id = p_execution_id and family_id = my_family_id() for update;
  if v_ex.id is null or v_ex.status <> 'pending' then raise exception 'already_reviewed'; end if;
  update executions
     set status = case when p_approve then 'approved' else 'rejected' end,
         parent_note = nullif(trim(p_note), ''),
         reviewed_at = now()
   where id = p_execution_id;
  if p_approve then
    select * into v_task from tasks where id = v_ex.task_id;
    insert into ledger (child_id, family_id, points, kind, ref_id, note)
    values (v_ex.child_id, v_ex.family_id, v_task.points, 'task', v_ex.id, v_task.title);
  end if;
end $$;

create function public.complete_goal(p_goal_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_goal goals;
begin
  if not is_parent() then raise exception 'forbidden'; end if;
  update goals set achieved_at = now()
   where id = p_goal_id and family_id = my_family_id() and achieved_at is null
  returning * into v_goal;
  if v_goal.id is not null and v_goal.bonus_points > 0 then
    insert into ledger (child_id, family_id, points, kind, ref_id, note)
    values (v_goal.child_id, v_goal.family_id, v_goal.bonus_points, 'goal', v_goal.id, 'Meta: ' || v_goal.title);
  end if;
end $$;

-- Cria o cadastro do responsável quando alguém se registra com e-mail.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.is_anonymous, false) = false then
    insert into parents (user_id, name) values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.create_family(text, integer) from anon;
revoke execute on function public.add_child(text, date, text, text) from anon;

-- Fotos das tarefas ------------------------------------------------------
-- Bucket privado. Caminho: <family_id>/<child_id>/<arquivo>.jpg
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false)
on conflict (id) do nothing;

create policy "família envia fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = my_family_id()::text);
create policy "família vê fotos" on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = my_family_id()::text);
