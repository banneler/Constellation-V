-- Run in Supabase SQL editor after manager_helpers.sql (public.is_manager() must exist).
-- Replaces manager SELECT-only policies with FOR ALL so managers can maintain team data
-- (including reassigning accounts/contacts/activities/tasks from the app without an RPC).
--
-- Deals already use "Managers can manage all deals"; left unchanged.
-- Sequences: managers/admins had SELECT-only on others' rows; allow full manage for team support.

-- ----- accounts -----
DROP POLICY IF EXISTS "Managers can view all accounts" ON public.accounts;
CREATE POLICY "Managers can manage all accounts"
  ON public.accounts
  FOR ALL
  TO public
  USING (is_manager() = true)
  WITH CHECK (is_manager() = true);

-- ----- contacts -----
DROP POLICY IF EXISTS "Managers can view all contacts" ON public.contacts;
CREATE POLICY "Managers can manage all contacts"
  ON public.contacts
  FOR ALL
  TO public
  USING (is_manager() = true)
  WITH CHECK (is_manager() = true);

-- ----- activities -----
DROP POLICY IF EXISTS "Managers can view all activities" ON public.activities;
CREATE POLICY "Managers can manage all activities"
  ON public.activities
  FOR ALL
  TO public
  USING (is_manager() = true)
  WITH CHECK (is_manager() = true);

-- ----- tasks -----
DROP POLICY IF EXISTS "Managers can view all tasks" ON public.tasks;
CREATE POLICY "Managers can manage all tasks"
  ON public.tasks
  FOR ALL
  TO public
  USING (is_manager() = true)
  WITH CHECK (is_manager() = true);

-- ----- cognito_alerts (manager visibility was SELECT-only) -----
DROP POLICY IF EXISTS "Managers can view all cognito alerts" ON public.cognito_alerts;
CREATE POLICY "Managers can manage all cognito alerts"
  ON public.cognito_alerts
  FOR ALL
  TO public
  USING (is_manager() = true)
  WITH CHECK (is_manager() = true);

-- ----- sequences (was manager/admin SELECT-only) -----
DROP POLICY IF EXISTS "Managers/Admins can view all sequences" ON public.sequences;
CREATE POLICY "Managers/Admins can manage all sequences"
  ON public.sequences
  FOR ALL
  TO public
  USING ((is_manager() = true) OR (is_admin() = true))
  WITH CHECK ((is_manager() = true) OR (is_admin() = true));

-- Optional cleanup after the app uses client-side reassignment everywhere:
-- DROP FUNCTION IF EXISTS public.reassign_account_to_user(bigint, uuid, boolean, boolean, boolean);
