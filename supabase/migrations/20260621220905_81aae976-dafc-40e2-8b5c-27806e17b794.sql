CREATE OR REPLACE FUNCTION public.find_user_by_email(_email text)
 RETURNS TABLE(user_id uuid, display_name text, avatar_url text, email text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.user_id, p.display_name, p.avatar_url, p.email
  FROM public.profiles p
  WHERE lower(p.email) = lower(_email)
  LIMIT 1;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.find_user_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO authenticated, service_role;
