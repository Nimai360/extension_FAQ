create or replace function public.update_user(
  nome text,
  telefone text default null,
  do_nothing boolean default false
) 
returns jsonb
language plpgsql
as $$
declare
  v_nome text := trim(coalesce(nome, ''));
  v_tel_in text := trim(coalesce(telefone, ''));
  v_tel_norm text;
  v_now timestamptz := now();
  v_id uuid;
  v_mode text;
  v_dup_id uuid;
begin
  -- Health check: não modifica dados
  if do_nothing is true then
    return jsonb_build_object('ok', true, 'noop', true);
  end if;

  -- Normaliza telefone: mantém apenas dígitos e '+', remove demais; vazio -> null
  v_tel_norm := nullif(regexp_replace(v_tel_in, '[^+0-9]', '', 'g'), '');

  --------------------------------------------------------------------
  -- Caso 1: temos telefone
  --------------------------------------------------------------------
  if v_tel_norm is not null then
    -- Existe alguém com esse telefone?
    select cw.id into v_id
    from public."ContatosWhatsapp" cw
    where cw.telefone = v_tel_norm
    limit 1;

    if v_id is not null then
      -- Atualiza nome (se mudou) e last_contact
      update public."ContatosWhatsapp" cw
      set 
        nome = case when v_nome <> '' and v_nome <> cw.nome then v_nome else cw.nome end,
        last_contact = v_now
      where cw.id = v_id;

      v_mode := 'update_by_phone';

      -- Verifica duplicata: contato só com nome (sem telefone) igual ao nome recebido
      if v_nome <> '' then
        select cw.id into v_dup_id
        from public."ContatosWhatsapp" cw
        where cw.nome = v_nome and (cw.telefone is null or cw.telefone = '')
        limit 1;

        if v_dup_id is not null and v_dup_id <> v_id then
          delete from public."ContatosWhatsapp" where id = v_dup_id;
          v_mode := v_mode || '_merged';
        end if;
      end if;

    else
      -- Não existe esse telefone: tentar localizar por nome
      if v_nome <> '' then
        select cw.id into v_id
        from public."ContatosWhatsapp" cw
        where cw.nome = v_nome
        limit 1;

        if v_id is not null then
          -- Atualiza esse contato, adicionando telefone
          update public."ContatosWhatsapp" cw
          set telefone = v_tel_norm, last_contact = v_now
          where cw.id = v_id;
          v_mode := 'update_by_name_add_phone';
        end if;
      end if;

      -- Se ainda não achou, insere novo
      if v_id is null then
        insert into public."ContatosWhatsapp"(nome, telefone, last_contact)
        values (coalesce(nullif(v_nome,''), '(sem nome)'), v_tel_norm, v_now)
        returning id into v_id;
        v_mode := 'insert_by_phone';
      end if;
    end if;

  --------------------------------------------------------------------
  -- Caso 2: não temos telefone mas temos nome
  --------------------------------------------------------------------
  elsif v_nome <> '' then
    -- Procura contato por nome
    update public."ContatosWhatsapp" cw
    set last_contact = v_now
    where cw.nome = v_nome
    returning cw.id into v_id;

    if v_id is null then
      insert into public."ContatosWhatsapp"(nome, telefone, last_contact)
      values (v_nome, null, v_now)
      returning id into v_id;
      v_mode := 'insert_by_name';
    else
      v_mode := 'update_by_name';
    end if;

  --------------------------------------------------------------------
  -- Caso 3: sem nome e sem telefone → erro
  --------------------------------------------------------------------
  else
    return jsonb_build_object('ok', false, 'error', 'empty_nome_and_telefone');
  end if;

  return jsonb_build_object('ok', true, 'mode', v_mode, 'id', v_id);
end;
$$;
