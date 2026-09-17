create table recipes (
    id uuid primary key,
    user_id uuid not null references users(id) on delete cascade,
    title text not null,
    instructions text not null,
    servings integer,
    status varchar(20) not null default 'suggested',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_recipes_user_id on recipes (user_id);

create table recipe_ingredients (
    id uuid primary key,
    recipe_id uuid not null references recipes(id) on delete cascade,
    inventory_item_id uuid references inventory_items(id) on delete set null,
    name text not null,
    quantity numeric(12, 3) not null,
    unit text not null
);

create index idx_recipe_ingredients_recipe_id on recipe_ingredients (recipe_id);

create table recipe_nutrition (
    recipe_id uuid primary key references recipes(id) on delete cascade,
    calories_per_serving numeric(10, 2),
    protein_grams numeric(10, 2),
    carbs_grams numeric(10, 2),
    fat_grams numeric(10, 2)
);
