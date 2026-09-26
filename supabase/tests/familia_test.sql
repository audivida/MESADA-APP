-- Roda depois de rewards_test.sql: façanhas, elogios, limite de prêmio e tarefa mensal.
\set ON_ERROR_STOP on
reset role;
insert into auth.users (id, is_anonymous) values ('00000000-0000-0000-0000-00000000000d', true);
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-00000000000a', false);
select add_child('Theo', '2013-07-02', '🐢', '4321') is not null as theo_criado;
select code as fam_code from families \gset
select id as lia from children where name = 'Lia' \gset
select id as theo from children where name = 'Theo' \gset
select set_config('test.lia', :'lia', false);
select set_config('test.theo', :'theo', false);
select set_config('test.uid', '00000000-0000-0000-0000-00000000000d', false);
select child_sign_in(:'fam_code', '4321') = :'theo'::uuid as theo_entrou;

-- Façanha: a Lia conta, só os pais aprovam e escolhem os pontos.
select set_config('test.uid', '00000000-0000-0000-0000-00000000000c', false);
select submit_feat(:'lia', 'Lavei a louça sem ninguém pedir', null) is not null as facanha_enviada;
do $$ begin
  perform submit_feat(current_setting('test.theo')::uuid, 'x', null);
  raise exception 'FALHA: enviou façanha pelo irmão';
exception when others then
  if sqlerrm like 'FALHA%' then raise; end if;
  raise notice 'ok: façanha só para si (%)', sqlerrm;
end $$;
do $$ begin
  insert into feats (child_id, family_id, title) values (my_child_id(), my_family_id(), 'x');
  raise exception 'FALHA: gravou façanha direto';
exception when insufficient_privilege then raise notice 'ok: façanha só pela função'; end $$;
do $$ begin
  perform review_feat((select id from feats limit 1), true, 999, '');
  raise exception 'FALHA: filho aprovou façanha';
exception when others then
  if sqlerrm like 'FALHA%' then raise; end if;
  raise notice 'ok: filho não aprova (%)', sqlerrm;
end $$;
select set_config('test.uid', '00000000-0000-0000-0000-00000000000a', false);
select review_feat((select id from feats limit 1), true, 15, 'Que orgulho!');
select points = 15 and kind = 'feat' as facanha_no_extrato from ledger where kind = 'feat';

-- Elogio da Lia para o Theo: fica pendente e sem pontos até os pais aprovarem.
select set_config('test.uid', '00000000-0000-0000-0000-00000000000c', false);
select send_praise(:'theo', 'Me ajudou no dever', 500) is not null as elogio_enviado;
select status = 'pending' and points = 0 and from_name = 'Lia' as elogio_pendente from praises;
do $$ begin
  perform send_praise(current_setting('test.lia')::uuid, 'Eu sou demais', 0);
  raise exception 'FALHA: elogiou a si mesma';
exception when others then
  if sqlerrm like 'FALHA%' then raise; end if;
  raise notice 'ok: sem autoelogio (%)', sqlerrm;
end $$;
select set_config('test.uid', '00000000-0000-0000-0000-00000000000a', false);
select review_praise((select id from praises limit 1), true, 5);
select sum(points) = 5 as theo_ganhou_5 from ledger where child_id = :'theo';
-- Elogio dos pais já vale na hora.
select send_praise(:'lia', 'Obrigada por cuidar das plantas', 3) is not null as elogio_dos_pais;
select count(*) = 2 as dois_elogios_no_extrato from ledger where kind = 'praise';

-- Limite: 1 por semana. Pedido recusado não conta.
insert into rewards (family_id, title, cost_points, limit_count, limit_period) values (my_family_id(), 'Açaí', 1, 1, 'week');
select id as acai from rewards where title = 'Açaí' \gset
select set_config('test.acai', :'acai', false);
select set_config('test.uid', '00000000-0000-0000-0000-00000000000c', false);
select request_redemption(:'acai', :'lia') is not null as primeiro_acai;
do $$ begin
  perform request_redemption(current_setting('test.acai')::uuid, my_child_id());
  raise exception 'FALHA: passou do limite';
exception when others then
  if sqlerrm like 'FALHA%' then raise; end if;
  raise notice 'ok: limite da semana (%)', sqlerrm;
end $$;
select set_config('test.uid', '00000000-0000-0000-0000-00000000000a', false);
select review_redemption((select id from redemptions where reward_id = :'acai'), false);
select set_config('test.uid', '00000000-0000-0000-0000-00000000000c', false);
select request_redemption(:'acai', :'lia') is not null as recusado_nao_conta;

-- Tarefa mensal precisa do dia do mês.
select set_config('test.uid', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  insert into tasks (family_id, title, points, recurrence) values (my_family_id(), 'x', 5, 'monthly');
  raise exception 'FALHA: mensal sem dia';
exception when check_violation then raise notice 'ok: mensal pede o dia'; end $$;
insert into tasks (family_id, title, points, recurrence, month_day, category) values (my_family_id(), 'Arrumar o armário', 30, 'monthly', 5, 'casa');
