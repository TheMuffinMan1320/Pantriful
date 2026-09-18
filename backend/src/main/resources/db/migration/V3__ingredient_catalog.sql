create table ingredient_catalog (
    id uuid primary key,
    barcode text not null unique,
    canonical_name text not null,
    brand text,
    default_unit text not null default 'count',
    category text,
    calories_per_100g numeric(10, 2),
    carbs_per_100g numeric(10, 2),
    fat_per_100g numeric(10, 2),
    protein_per_100g numeric(10, 2),
    source text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
