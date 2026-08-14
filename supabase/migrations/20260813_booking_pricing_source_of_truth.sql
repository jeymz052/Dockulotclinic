  insert into public.pricing (code, name, category, price)
  values
    ('GEN-CONSULT', 'First Clinic Consultation', 'Consultation', 600),
    ('FOLLOW-UP', 'Clinic Follow-up Consultation', 'Consultation', 300),
    ('ONLINE-CONSULT', 'Virtual Consult', 'Consultation', 800),
    ('PROC-RESERVATION', 'Medical Procedure Reservation Fee', 'Procedure', 1000),
    ('PROC-BOTOX', 'Botox', 'Procedure', 200),
    ('PROC-MESOLIPO', 'Mesolipo', 'Procedure', 4900),
    ('PROC-FILLERS', 'Fillers', 'Procedure', 4999),
    ('PROC-SCLEROTHERAPY', 'Sclerotherapy', 'Procedure', 5999),
    ('PROC-WART-REMOVAL', 'Wart Removal / Skin Tag Removal', 'Procedure', 2999),
    ('PROC-MOLE-SURGERY', 'Mole Surgery', 'Procedure', 6999),
    ('PROC-GLP-INITIATION', 'GLP Initiation', 'Procedure', 0)
  on conflict (code) do update
  set
    name = excluded.name,
    category = excluded.category;
