-- Keep the legacy auth metadata and user_quotas manager sources aligned.
-- Some accounts store is_manager in raw_user_meta_data, while the existing
-- auth.users trigger only read raw_app_meta_data and could overwrite
-- public.user_quotas.is_manager with null.

CREATE OR REPLACE FUNCTION public.sync_user_manager_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.user_quotas uq
    SET is_manager = CASE
        WHEN (NEW.raw_app_meta_data ? 'is_manager') OR (NEW.raw_user_meta_data ? 'is_manager')
            THEN public.is_manager_from_jwt_meta(NEW.raw_app_meta_data)
                OR public.is_manager_from_jwt_meta(NEW.raw_user_meta_data)
        ELSE uq.is_manager
    END
    WHERE uq.user_id = NEW.id;

    RETURN NEW;
END;
$$;
