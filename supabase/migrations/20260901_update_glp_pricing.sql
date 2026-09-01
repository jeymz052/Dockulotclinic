-- Update baseline price for GLP Initiation in public.pricing table to 10,000
update public.pricing
set price = 10000
where code = 'PROC-GLP-INITIATION';
