-- Coach chat threads: one row per conversation (title + recency) so users can start, browse
-- and delete threads. Messages cascade with their conversation.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_user_updated_idx on public.conversations (user_id, updated_at desc);
alter table public.conversations enable row level security;
create policy "Users manage own conversations" on public.conversations
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Backfill existing threads; title = first user message (whitespace collapsed, 60 chars).
insert into public.conversations (id, user_id, title, created_at, updated_at)
select m.conversation_id,
       (array_agg(m.user_id))[1],
       coalesce(left(regexp_replace((array_agg(m.content order by m.created_at) filter (where m.role = 'user'))[1], '\s+', ' ', 'g'), 60), 'Chat'),
       min(m.created_at),
       max(m.created_at)
from public.chat_messages m
group by m.conversation_id
on conflict (id) do nothing;

alter table public.chat_messages
  add constraint chat_messages_conversation_fk
  foreign key (conversation_id) references public.conversations(id) on delete cascade;
create index if not exists chat_messages_conversation_idx on public.chat_messages (conversation_id, created_at);
