-- Fluxo completo: responsável cria família, filho entra, envia, pai aprova.
\set ON_ERROR_STOP on
insert into auth.users (id, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000000a', '{"name":"Grazi"}');
insert into auth.users (id, is_anonymous) values ('00000000-0000-0000-0000-00000000000c', true);
insert into auth.users (id, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000000e', '{"name":"Estranho"}');

set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-00000000000a', false);
select create_family('Família Teste', 10) is not null as familia_criada;
select add_child('Lia', '2017-03-12', '🦊', '1234') is not null as filho_criado;
insert into tasks (family_id, title, points, recurrence) values (my_family_id(), 'Arrumar a cama', 5, 'daily');
select code as fam_code from families \gset
select set_config('test.code', :'fam_code', false);
select id as task_id from tasks \gset
select id as child_id from children \gset
select set_config('test.task', :'task_id', false);
select family_id as fam_id from tasks \gset
select set_config('test.fam', :'fam_id', false);

do $$ begin
  perform pin_hash from children;
  raise exception 'FALHA: pin_hash legível';
exception when insufficient_privilege then raise notice 'ok: pin_hash protegido'; end $$;

-- Filho: PIN errado falha, certo entra.
select set_config('test.uid', '00000000-0000-0000-0000-00000000000c', false);
do $$ begin
  perform child_sign_in(current_setting('test.code'), '0000');
  raise exception 'FALHA: PIN errado aceito';
exception when others then
  if sqlerrm like 'FALHA%' then raise; end if;
  raise notice 'ok: PIN errado recusado (%)', sqlerrm;
end $$;
select child_sign_in(:'fam_code', '1234') = :'child_id'::uuid as filho_entrou;
select count(*) = 1 as filho_ve_tarefa from tasks;

-- Filho não cria tarefa nem se dá pontos.
do $$ begin
  insert into tasks (family_id, title, points, recurrence) values (my_family_id(), 'x', 999, 'daily');
  raise exception 'FALHA: filho criou tarefa';
exception when insufficient_privilege then raise notice 'ok: filho não cria tarefa'; end $$;
do $$ begin
  insert into ledger (child_id, family_id, points, kind, note) values (my_child_id(), my_family_id(), 999, 'bonus', 'x');
  raise exception 'FALHA: filho lançou pontos';
exception when insufficient_privilege then raise notice 'ok: filho não lança pontos'; end $$;

-- Sem foto numa tarefa que exige foto: recusado.
do $$ begin
  perform submit_execution(current_setting('test.task')::uuid, my_child_id(), current_date, null);
  raise exception 'FALHA: aceitou sem foto';
exception when others then
  if sqlerrm like 'FALHA%' then raise; end if;
  raise notice 'ok: foto obrigatória (%)', sqlerrm;
end $$;
select submit_execution(:'task_id', :'child_id', current_date, (select family_id::text from children) || '/' || :'child_id' || '/a.jpg') is not null as enviou;
do $$ begin
  perform submit_execution(current_setting('test.task')::uuid, my_child_id(), current_date, current_setting('test.fam') || '/x/b.jpg');
  raise exception 'FALHA: enviou duas vezes';
exception when others then
  if sqlerrm like 'FALHA%' then raise; end if;
  raise notice 'ok: envio duplicado recusado (%)', sqlerrm;
end $$;

-- Filho não aprova.
do $$ begin
  perform review_execution((select id from executions limit 1), true, '');
  raise exception 'FALHA: filho aprovou';
exception when others then
  if sqlerrm like 'FALHA%' then raise; end if;
  raise notice 'ok: filho não aprova (%)', sqlerrm;
end $$;

-- Outra família não vê nada.
select set_config('test.uid', '00000000-0000-0000-0000-00000000000e', false);
select (select count(*) from tasks) = 0 and (select count(*) from children) = 0 and (select count(*) from executions) = 0 as estranho_nao_ve;

-- Pai aprova: entram 5 pontos.
select set_config('test.uid', '00000000-0000-0000-0000-00000000000a', false);
select review_execution((select id from executions limit 1), true, 'Ficou ótimo!');
select sum(points) = 5 as saldo_5 from ledger;
insert into ledger (child_id, family_id, points, kind, note) values (:'child_id', my_family_id(), -3, 'payout', 'Mesada paga');
select sum(points) = 2 as saldo_2 from ledger;
insert into goals (child_id, family_id, title, target_points, bonus_points) values (:'child_id', my_family_id(), 'Bola', 100, 10);
select complete_goal((select id from goals limit 1));
select complete_goal((select id from goals limit 1));
select sum(points) = 12 as bonus_meta_uma_vez from ledger;

-- Pai não lança pontos para filho de outra família.
do $$ begin
  insert into ledger (child_id, family_id, points, kind, note) values (gen_random_uuid(), my_family_id(), 5, 'bonus', 'x');
  raise exception 'FALHA: lançou para filho desconhecido';
exception when insufficient_privilege then raise notice 'ok: só filhos da família'; end $$;
