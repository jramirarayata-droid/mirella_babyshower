-- =============================================================================
--  047 — Discounts on plans (needs 046)
--
--  The owner can put any plan on sale from the Owner page: a sale price, a
--  short label ("Holiday sale") and an optional last day. The sign-in & plans
--  page then shows the old price crossed out next to the sale price. When the
--  last day has passed the sale ends by itself.
-- =============================================================================

alter table public.plans add column if not exists sale_price_php integer check (sale_price_php is null or sale_price_php >= 0);
alter table public.plans add column if not exists sale_label text not null default '';
alter table public.plans add column if not exists sale_ends date;

-- Owner: change a plan's price, guest limit and sale.
create or replace function public.owner_save_plan(
  p_id text, p_price integer, p_guest_limit integer,
  p_sale_price integer, p_sale_label text, p_sale_ends date
)
returns void language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_sale_price is not null and p_sale_price >= p_price then
    raise exception 'The sale price must be lower than the usual price.' using errcode = 'P0001', hint = 'plan_sale_price';
  end if;
  update public.plans set
    price_php = p_price,
    guest_limit = p_guest_limit,
    sale_price_php = p_sale_price,
    sale_label = left(btrim(coalesce(p_sale_label, '')), 40),
    sale_ends = p_sale_ends,
    updated_at = now()
  where id = p_id;
  if not found then
    raise exception 'No such plan' using errcode = 'P0002';
  end if;
end;
$$;
grant execute on function public.owner_save_plan(text, integer, integer, integer, text, date) to authenticated;
