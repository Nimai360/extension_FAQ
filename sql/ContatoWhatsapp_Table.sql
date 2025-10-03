create table public.contatoswhatsapp (
   id           uuid not null default gen_random_uuid(),
   created_at   timestamp with time zone not null default now(),
   nome         text not null,
   telefone     text,
   last_contact timestamp with time zone not null,
   is_client    boolean not null default true,
   obs          text,
   constraint contatoswhatsapp_pkey primary key ( id )
);