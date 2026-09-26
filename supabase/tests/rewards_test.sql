-- Roda depois de flow_test.sql (reaproveita a família criada lá; a Lia tem 12 pontos).
\set ON_ERROR_STOP on
select id as child_id from children limit 1 \gset
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-00000000000a', false);
insert into rewards (family_id, title, cost_points) values (my_family_id(), 'Tela extra', 10);
insert into rewards (family_id, title, cost_points) values (my_family_id(), 'Bicicleta', 500);
select id as cheap from rewards where cost_points = 10 \gset
select id as pricey from rewards where cost_points = 500 \gset
select set_config('test.cheap', :'cheap', false);
select set_config('test.pricey', :'pricey', false);

-- Filho pede: o barato passa, o caro não, e um segundo barato estoura o saldo livre.
select set_config('test.uid', '00000000-0000-0000-0000-00000000000c', false);
select request_redemption(:'cheap', :'child_id') is not null as pediu;
do $$ begin
  perform request_redemption(current_setting('test.pricey')::uuid, my_child_id());
  raise exception 'FALHA: pediu sem saldo';
exception when others then
  if sqlerrm like 'FALHA%' then raise; end if;
  raise notice 'ok: sem saldo (%)', sqlerrm;
end $$;
do $$ begin
  perform request_redemption(current_setting('test.cheap')::uuid, my_child_id());
  raise exception 'FALHA: saldo reservado foi gasto duas vezes';
exception when others then
  if sqlerrm like 'FALHA%' then raise; end if;
  raise notice 'ok: saldo reservado (%)', sqlerrm;
end $$;
do $$ begin
  insert into rewards (family_id, title, cost_points) values (my_family_id(), 'x', 1);
  raise exception 'FALHA: filho criou prêmio';
exception when insufficient_privilege then raise notice 'ok: filho não cria prêmio'; end $$;
do $$ begin
  perform review_redemption((select id from redemptions limit 1), true);
  raise exception 'FALHA: filho entregou prêmio';
exception when others then
  if sqlerrm like 'FALHA%' then raise; end if;
  raise notice 'ok: filho não entrega (%)', sqlerrm;
end $$;

-- Pais entregam: saem 10 pontos, uma vez só.
select set_config('test.uid', '00000000-0000-0000-0000-00000000000a', false);
select review_redemption((select id from redemptions limit 1), true);
select sum(points) = 2 as saldo_2_depois_do_premio from ledger;
do $$ begin
  perform review_redemption((select id from redemptions limit 1), true);
  raise exception 'FALHA: entregou duas vezes';
exception when others then
  if sqlerrm like 'FALHA%' then raise; end if;
  raise notice 'ok: entrega única (%)', sqlerrm;
end $$;
