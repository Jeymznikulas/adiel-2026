alter table public.item_variants
add column supplier_id uuid references public.suppliers (id) on delete set null;

update public.item_variants variant
set supplier_id = item.supplier_id
from public.items item
where item.id = variant.item_id
  and variant.supplier_id is null;

create index item_variants_supplier_id_idx
on public.item_variants (supplier_id);
