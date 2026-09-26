#!/usr/bin/env bash
# Testa a migração num Postgres local. Uso: PGHOST=... PGPORT=... ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
P="psql -U ${PGUSER:-postgres} -v ON_ERROR_STOP=1 -q"
$P -d postgres -c 'drop database if exists mesada_test' -c 'create database mesada_test'
$P -d mesada_test -f supabase/tests/stub_supabase.sql
for f in supabase/migrations/*.sql; do $P -d mesada_test -f "$f"; done
$P -d mesada_test -f supabase/tests/flow_test.sql
$P -d mesada_test -f supabase/tests/rewards_test.sql
echo "Todos os testes do banco passaram."
