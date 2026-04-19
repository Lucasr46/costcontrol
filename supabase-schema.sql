create extension if not exists pgcrypto;

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists monthly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_key text not null,
  income_amount numeric not null default 0,
  fixed_percent integer not null default 50,
  variable_percent integer not null default 30,
  investment_percent integer not null default 20,
  created_at timestamptz not null default now(),
  unique (user_id, month_key)
);

create table if not exists categories (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense', 'investment')),
  cost_classification text check (cost_classification in ('fixed', 'variable') or cost_classification is null),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense', 'investment')),
  description text not null,
  amount numeric not null,
  date date not null,
  category_id text not null,
  competence text not null,
  periodicity text not null default 'single',
  installments integer not null default 1,
  recurrence_months integer not null default 1,
  installment_number integer not null default 1,
  type_cost text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, category_id) references categories(user_id, id) on delete restrict
);

create table if not exists app_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_month text,
  dashboard_category_id text,
  filters jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table monthly_plans enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table app_preferences enable row level security;

create policy "profiles_select_own" on profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = user_id);

create policy "plans_select_own" on monthly_plans for select using (auth.uid() = user_id);
create policy "plans_insert_own" on monthly_plans for insert with check (auth.uid() = user_id);
create policy "plans_update_own" on monthly_plans for update using (auth.uid() = user_id);
create policy "plans_delete_own" on monthly_plans for delete using (auth.uid() = user_id);

create policy "categories_select_own" on categories for select using (auth.uid() = user_id);
create policy "categories_insert_own" on categories for insert with check (auth.uid() = user_id);
create policy "categories_update_own" on categories for update using (auth.uid() = user_id);
create policy "categories_delete_own" on categories for delete using (auth.uid() = user_id);

create policy "transactions_select_own" on transactions for select using (auth.uid() = user_id);
create policy "transactions_insert_own" on transactions for insert with check (auth.uid() = user_id);
create policy "transactions_update_own" on transactions for update using (auth.uid() = user_id);
create policy "transactions_delete_own" on transactions for delete using (auth.uid() = user_id);

create policy "preferences_select_own" on app_preferences for select using (auth.uid() = user_id);
create policy "preferences_insert_own" on app_preferences for insert with check (auth.uid() = user_id);
create policy "preferences_update_own" on app_preferences for update using (auth.uid() = user_id);
