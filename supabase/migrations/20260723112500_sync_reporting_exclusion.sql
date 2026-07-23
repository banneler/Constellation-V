-- Keep Auth metadata and public.user_quotas reporting exclusion aligned.
-- The existing update-user-admin function writes exclude_from_reporting to auth metadata;
-- Admin now reads public.user_quotas, so sync the metadata value into the quota row.

CREATE OR REPLACE FUNCTION public.sync_user_manager_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.user_quotas uq
    SET
        is_manager = CASE
            WHEN (NEW.raw_app_meta_data ? 'is_manager') OR (NEW.raw_user_meta_data ? 'is_manager')
                THEN public.is_manager_from_jwt_meta(NEW.raw_app_meta_data)
                    OR public.is_manager_from_jwt_meta(NEW.raw_user_meta_data)
            ELSE uq.is_manager
        END,
        exclude_from_reporting = CASE
            WHEN (NEW.raw_app_meta_data ? 'exclude_from_reporting') OR (NEW.raw_user_meta_data ? 'exclude_from_reporting')
                THEN lower(trim(COALESCE(
                    NEW.raw_app_meta_data ->> 'exclude_from_reporting',
                    NEW.raw_user_meta_data ->> 'exclude_from_reporting',
                    'false'
                ))) IN ('true', 't', '1', 'yes')
            ELSE uq.exclude_from_reporting
        END
    WHERE uq.user_id = NEW.id;

    RETURN NEW;
END;
$$;

UPDATE public.user_quotas uq
SET exclude_from_reporting = lower(trim(COALESCE(
    au.raw_app_meta_data ->> 'exclude_from_reporting',
    au.raw_user_meta_data ->> 'exclude_from_reporting',
    'false'
))) IN ('true', 't', '1', 'yes')
FROM auth.users au
WHERE uq.user_id = au.id
  AND (
    au.raw_app_meta_data ? 'exclude_from_reporting'
    OR au.raw_user_meta_data ? 'exclude_from_reporting'
  );
