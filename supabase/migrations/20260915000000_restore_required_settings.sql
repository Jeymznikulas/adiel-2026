begin;

-- Restore singleton settings and numbering rules if a data import omitted them.
-- Existing customized rows keep their values and versions.
insert into public.company_settings (id)
values (true)
on conflict (id) do nothing;

insert into public.document_defaults (
  id,
  quotation_terms,
  purchase_order_terms,
  statement_payment_instructions,
  pdf_footer
)
values (
  true,
  E'Prices and availability are valid only for the scope shown in this quotation.\nChanges to quantities, specifications, or delivery location may require a revised quotation.',
  E'All supplied items must match the specifications and quantities stated in this purchase order.\nPrices are inclusive of all agreed charges unless separately itemized in this document.\nThe supplier must reference the PO number on all delivery receipts and invoices.\nDelivery schedules or substitutions require prior written approval from ADIEL Construction Supplies.',
  'Please include the SOA number as the payment reference and send proof of payment to the accounts contact shown above.',
  'Generated electronically by the ADIEL Operations System.'
)
on conflict (id) do nothing;

insert into public.document_numbering_rules
  (document_type, prefix, starting_number, digits, include_year, reset_yearly)
values
  ('quotation', 'QT', 1, 3, true, true),
  ('purchase_order', 'PO', 1, 3, true, true),
  ('statement_of_account', 'SOA', 1, 3, true, true)
on conflict (document_type) do nothing;

commit;
