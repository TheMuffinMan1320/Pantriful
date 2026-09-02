create table users (
    id uuid primary key,
    email text not null unique,
    oauth_provider varchar(20) not null,
    oauth_subject text not null,
    display_name text,
    push_token text,
    low_stock_notifications_enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_users_oauth unique (oauth_provider, oauth_subject)
);

create table inventory_items (
    id uuid primary key,
    user_id uuid not null references users(id) on delete cascade,
    name text not null,
    quantity numeric(12, 3) not null default 0,
    unit text not null default 'count',
    category text,
    expiration_date date,
    low_stock_threshold numeric(12, 3),
    low_stock_notified_at timestamptz,
    image_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_inventory_items_user_id on inventory_items (user_id);
