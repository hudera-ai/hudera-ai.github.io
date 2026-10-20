#!/bin/bash
# LOCAL TESTING ONLY: recreate the test database and apply the shim + all migrations.
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
su postgres -c "psql -qc \"do \\\$\\\$ begin if not exists (select 1 from pg_roles where rolname='root') then create role root superuser login; end if; end \\\$\\\$\"" && su postgres -c "psql -q -v ON_ERROR_STOP=1 -c 'drop database if exists hudera_test' -c 'create database hudera_test'"
cat "$DIR/local/00_supabase_shim.sql" "$DIR"/supabase/migrations/*.sql > /tmp/hudera_all.sql
chmod 644 /tmp/hudera_all.sql
su postgres -c "psql -q -v ON_ERROR_STOP=1 -d hudera_test -f /tmp/hudera_all.sql"
echo "migrations applied"
