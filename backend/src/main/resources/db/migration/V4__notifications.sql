create table notifications (
    id uuid primary key,
    user_id uuid not null references users(id) on delete cascade,
    inventory_item_id uuid references inventory_items(id) on delete set null,
    type varchar(30) not null,
    message text not null,
    sent_at timestamptz not null default now()
);

create index idx_notifications_user_id on notifications (user_id);
