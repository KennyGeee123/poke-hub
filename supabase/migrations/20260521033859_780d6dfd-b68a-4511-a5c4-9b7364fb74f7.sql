REVOKE EXECUTE ON FUNCTION public.find_user_by_email(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.are_friends(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_friends(UUID, UUID) TO authenticated;
