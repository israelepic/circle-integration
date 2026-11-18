-- USDC payouts on Arc. Amounts are USD cents.

create table public.creator_usdc_wallets (
  creator_id uuid primary key references public.creators (id) on delete restrict,
  create_key uuid not null unique default public.new_id(),
  wallet_id text unique,
  address text check (address ~ '^0x[0-9a-fA-F]{40}$'),
  chain text not null default 'ARC-TESTNET' check (chain in ('ARC-TESTNET', 'ARC')),
  status text not null default 'creating' check (status in ('creating', 'active', 'failed')),
  last_error text check (char_length(last_error) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger creator_usdc_wallets_updated_at before update on public.creator_usdc_wallets
  for each row execute procedure private.set_updated_at();

create table public.usdc_payouts (
  id uuid primary key default public.new_id(),
  creator_id uuid not null references public.creators (id) on delete restrict,
  source_type text not null check (source_type in ('slot', 'gig_post', 'demo')),
  source_id text not null check (char_length(source_id) <= 64),
  verified_views integer check (verified_views >= 0),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'USD' check (currency = 'USD'),
  status text not null default 'queued' check (status in ('queued', 'sent', 'paid', 'failed')),
  transfer_key uuid not null unique default public.new_id(),
  transaction_id text unique,
  tx_hash text check (tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  provider_state text check (char_length(provider_state) <= 20),
  attempts integer not null default 0,
  last_error text check (char_length(last_error) <= 300),
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_id)
);
create index usdc_payouts_creator_idx on public.usdc_payouts (creator_id, created_at desc);
create index usdc_payouts_due_idx on public.usdc_payouts (next_attempt_at) where status in ('queued', 'sent');
create trigger usdc_payouts_updated_at before update on public.usdc_payouts
  for each row execute procedure private.set_updated_at();

alter table public.creator_usdc_wallets enable row level security;
alter table public.creator_usdc_wallets force row level security;
alter table public.usdc_payouts enable row level security;
alter table public.usdc_payouts force row level security;

create policy "creator_usdc_wallets: read own" on public.creator_usdc_wallets for select
  using (private.is_service() or creator_id = private.current_creator_id());
create policy "creator_usdc_wallets: service writes" on public.creator_usdc_wallets for all
  using (private.is_service()) with check (private.is_service());
create policy "usdc_payouts: read own" on public.usdc_payouts for select
  using (private.is_service() or creator_id = private.current_creator_id());
create policy "usdc_payouts: service writes" on public.usdc_payouts for all
  using (private.is_service()) with check (private.is_service());
