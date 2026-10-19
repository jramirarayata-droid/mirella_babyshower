#!/bin/bash
# Database tests for the multi-space setup (046). Runs against a throwaway local
# PostgreSQL that imitates Supabase (bootstrap.sql) — never against a real project.
#   PGHOST=/path/to/socket PGPORT=5432 tests/db/run.sh
# Needs a local superuser named supabase_admin.
set -e
cd "$(dirname "$0")"
R=$(cd ../.. && pwd)
PSQL="psql -v ON_ERROR_STOP=1 -q"
$PSQL -U supabase_admin -d postgres -c "drop database if exists sb" >/dev/null 2>&1 || true
for r in tenant_fn postgres anon authenticated service_role authenticator; do
  $PSQL -U supabase_admin -d postgres -c "drop owned by $r cascade" >/dev/null 2>&1 || true
done
$PSQL -U supabase_admin -d postgres -c "drop role if exists tenant_fn; drop role if exists authenticator; drop role if exists service_role; drop role if exists authenticated; drop role if exists anon; drop role if exists postgres;" >/dev/null 2>&1 || true
$PSQL -U supabase_admin -d postgres -f bootstrap.sql >/dev/null
$PSQL -U postgres -d sb -f "$R/supabase/schema.sql" >/dev/null 2>&1
for f in "$R"/supabase/migrations/0[0-3]*.sql "$R"/supabase/migrations/04[0-5]*.sql; do $PSQL -U postgres -d sb -f "$f" >/dev/null 2>&1; done
$PSQL -U supabase_admin -d sb -f test_users.sql >/dev/null
$PSQL -U postgres -d sb -f "$R/supabase/seed.sql" >/dev/null
$PSQL -U postgres -d sb -f "$R/supabase/migrations/046_multi_tenant.sql" >/dev/null 2>&1
out=$(psql -U postgres -d sb -f isolation_test.sql 2>&1; psql -U postgres -d sb -f regression_test.sql 2>&1)
echo "$out" | grep -E "PASS|FAIL|ERROR" | sed -E 's/^psql:[^ ]* //; s/^NOTICE:  //'
echo "$out" | grep -qE "FAIL|ERROR" && exit 1 || echo "all passed"
