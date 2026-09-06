-- =========================================================
-- Real-Time Messaging Feature
-- Run in the Supabase SQL editor (or via migration runner).
-- =========================================================

-- Persist online presence on the shared profiles table
alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- =========================================================
-- Conversations (one row per patient↔clinic-user thread)
-- =========================================================
create table if not exists public.message_conversations (
  id                    uuid primary key default gen_random_uuid(),
  -- The patient side of the conversation
  patient_id            uuid not null references public.profiles(id) on delete cascade,
  -- The clinic-side user who started / owns the thread (doctor / admin / secretary)
  clinic_user_id        uuid not null references public.profiles(id) on delete cascade,
  last_message_at       timestamptz,
  last_message_preview  text,
  -- Unread counts: how many messages the respective side hasn't read
  unread_clinic         integer not null default 0,
  unread_patient        integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- One conversation per (patient, clinic_user) pair
  unique (patient_id, clinic_user_id)
);

create index if not exists mc_patient_idx       on public.message_conversations(patient_id);
create index if not exists mc_clinic_user_idx   on public.message_conversations(clinic_user_id);
create index if not exists mc_last_msg_idx      on public.message_conversations(last_message_at desc nulls last);

-- =========================================================
-- Messages
-- =========================================================
create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.message_conversations(id) on delete cascade,
  sender_id        uuid not null references public.profiles(id) on delete cascade,
  -- Text body (nullable when message is attachment-only)
  body             text,
  -- Attachment fields
  attachment_url   text,
  attachment_type  text check (attachment_type in ('image', 'file', 'link') or attachment_type is null),
  attachment_name  text,   -- original file name or link title
  attachment_size  bigint, -- bytes
  -- Read tracking
  is_read          boolean not null default false,
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists msg_conversation_idx  on public.messages(conversation_id, created_at desc);
create index if not exists msg_sender_idx        on public.messages(sender_id);
create index if not exists msg_unread_idx        on public.messages(conversation_id, is_read) where not is_read;

-- =========================================================
-- Row Level Security
-- =========================================================

-- message_conversations
alter table public.message_conversations enable row level security;

-- Clinic staff can see all conversations
create policy "clinic_staff_see_all_conversations"
  on public.message_conversations for select
  using (public.is_clinic_staff());

-- Patients can only see their own conversation
create policy "patient_see_own_conversation"
  on public.message_conversations for select
  using (
    not public.is_clinic_staff()
    and patient_id = auth.uid()
  );

-- Clinic staff can insert conversations
create policy "clinic_staff_insert_conversation"
  on public.message_conversations for insert
  with check (public.is_clinic_staff());

-- Patients can insert their own conversation (start thread)
create policy "patient_insert_own_conversation"
  on public.message_conversations for insert
  with check (
    not public.is_clinic_staff()
    and patient_id = auth.uid()
  );

-- Both sides can update (for unread count, last_message_at)
create policy "conversation_update"
  on public.message_conversations for update
  using (
    public.is_clinic_staff()
    or patient_id = auth.uid()
  );

-- messages
alter table public.messages enable row level security;

-- Clinic staff can read any message in any conversation
create policy "clinic_staff_read_messages"
  on public.messages for select
  using (
    public.is_clinic_staff()
    and exists (
      select 1 from public.message_conversations mc
      where mc.id = messages.conversation_id
    )
  );

-- Patients can read messages only in their own conversation
create policy "patient_read_own_messages"
  on public.messages for select
  using (
    not public.is_clinic_staff()
    and exists (
      select 1 from public.message_conversations mc
      where mc.id = messages.conversation_id
        and mc.patient_id = auth.uid()
    )
  );

-- Any authenticated participant can insert (send a message)
create policy "participant_send_message"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and (
      public.is_clinic_staff()
      or exists (
        select 1 from public.message_conversations mc
        where mc.id = messages.conversation_id
          and mc.patient_id = auth.uid()
      )
    )
  );

-- Allow participants to update is_read / read_at
create policy "participant_mark_read"
  on public.messages for update
  using (
    public.is_clinic_staff()
    or exists (
      select 1 from public.message_conversations mc
      where mc.id = messages.conversation_id
        and mc.patient_id = auth.uid()
    )
  );

-- =========================================================
-- Trigger: keep last_message_at, preview, unread counts in sync
-- =========================================================
create or replace function public.after_message_insert()
returns trigger
language plpgsql
as $$
declare
  v_patient_id  uuid;
  v_clinic_id   uuid;
  v_is_clinic   boolean;
begin
  select patient_id, clinic_user_id
    into v_patient_id, v_clinic_id
    from public.message_conversations
   where id = new.conversation_id;

  -- is the sender the patient or the clinic side?
  v_is_clinic := (new.sender_id <> v_patient_id);

  update public.message_conversations
  set
    last_message_at      = new.created_at,
    last_message_preview = left(coalesce(new.body, new.attachment_name, 'Attachment'), 120),
    -- increment unread for the OTHER side
    unread_clinic        = case when not v_is_clinic then unread_clinic  + 1 else unread_clinic  end,
    unread_patient       = case when v_is_clinic     then unread_patient + 1 else unread_patient end,
    updated_at           = now()
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists trg_after_message_insert on public.messages;
create trigger trg_after_message_insert
  after insert on public.messages
  for each row execute function public.after_message_insert();

-- =========================================================
-- Storage bucket: chat-attachments
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  true,
  10485760, -- 10 MB
  array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
)
on conflict (id) do nothing;

-- Storage RLS: authenticated users can upload; public can read (bucket is public)
create policy "chat_attachments_upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-attachments');

create policy "chat_attachments_read"
  on storage.objects for select
  using (bucket_id = 'chat-attachments');
