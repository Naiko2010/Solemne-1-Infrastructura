-- Políticas RLS para public.locals cuando el backend usa la anon key + JWT de usuario (PostgREST).
-- Si ya tienes políticas, revisa conflictos antes de ejecutar (Supabase → SQL Editor).
--
-- Requisito: el JWT debe incluir business_id en user_metadata o app_metadata (como en el frontend).

ALTER TABLE public.locals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "locals_select_authenticated_same_business" ON public.locals;
CREATE POLICY "locals_select_authenticated_same_business"
  ON public.locals
  FOR SELECT
  TO authenticated
  USING (
    business_id IS NOT NULL
    AND (
      business_id::text = (auth.jwt() -> 'user_metadata' ->> 'business_id')
      OR business_id::text = (auth.jwt() -> 'app_metadata' ->> 'business_id')
    )
  );

DROP POLICY IF EXISTS "locals_insert_authenticated_same_business" ON public.locals;
CREATE POLICY "locals_insert_authenticated_same_business"
  ON public.locals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND (
      business_id::text = (auth.jwt() -> 'user_metadata' ->> 'business_id')
      OR business_id::text = (auth.jwt() -> 'app_metadata' ->> 'business_id')
    )
  );

DROP POLICY IF EXISTS "locals_update_authenticated_same_business" ON public.locals;
CREATE POLICY "locals_update_authenticated_same_business"
  ON public.locals
  FOR UPDATE
  TO authenticated
  USING (
    business_id IS NOT NULL
    AND (
      business_id::text = (auth.jwt() -> 'user_metadata' ->> 'business_id')
      OR business_id::text = (auth.jwt() -> 'app_metadata' ->> 'business_id')
    )
  )
  WITH CHECK (
    business_id IS NOT NULL
    AND (
      business_id::text = (auth.jwt() -> 'user_metadata' ->> 'business_id')
      OR business_id::text = (auth.jwt() -> 'app_metadata' ->> 'business_id')
    )
  );
