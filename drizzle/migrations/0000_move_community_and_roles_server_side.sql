CREATE TYPE public.app_role AS ENUM ('Owner','Admin','Mod','User');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('Owner','Admin'))
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY array_position(ARRAY['Owner','Admin','Mod','User']::public.app_role[], role) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_disposable_email(_email text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(split_part(_email, '@', 2)) = ANY (ARRAY[
    'mailinator.com','tempmail.com','10minutemail.com','guerrillamail.com','yopmail.com',
    'throwawaymail.com','fakeinbox.com','sharklasers.com','getairmail.com','burnermail.io',
    'temp-mail.org','mailnesia.com'])
$$;

CREATE OR REPLACE FUNCTION public.block_disposable_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_disposable_email(NEW.email) THEN
    RAISE EXCEPTION 'Disposable email addresses are not allowed.';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _username text;
BEGIN
  _username := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'username'), ''), split_part(NEW.email, '@', 1));
  INSERT INTO public.users (id, email, username) VALUES (NEW.id, NEW.email, _username)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN lower(NEW.email) = 'ifunhd2016@gmail.com' THEN 'Owner'::public.app_role ELSE 'User'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER block_disposable_before_signup BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.block_disposable_signup();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing accounts
INSERT INTO public.users (id, email, username)
SELECT u.id, u.email, COALESCE(NULLIF(trim(u.raw_user_meta_data->>'username'), ''), split_part(u.email, '@', 1))
FROM auth.users u ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, CASE WHEN lower(u.email) = 'ifunhd2016@gmail.com' THEN 'Owner'::public.app_role ELSE 'User'::public.app_role END
FROM auth.users u ON CONFLICT DO NOTHING;

-- users table: read-only for signed-in users; changes go through RPCs
DROP POLICY IF EXISTS read_users ON public.users;
DROP POLICY IF EXISTS insert_users ON public.users;
DROP POLICY IF EXISTS update_users ON public.users;
DROP POLICY IF EXISTS delete_users ON public.users;
COMMENT ON COLUMN public.users.role IS 'DEPRECATED: roles live in public.user_roles';
REVOKE ALL ON public.users FROM anon;
GRANT SELECT ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
CREATE POLICY users_read ON public.users FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.list_users()
RETURNS TABLE (id uuid, email text, username text, role public.app_role, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN QUERY
  SELECT u.id, u.email, u.username,
    COALESCE((SELECT r.role FROM public.user_roles r WHERE r.user_id = u.id
      ORDER BY array_position(ARRAY['Owner','Admin','Mod','User']::public.app_role[], r.role) LIMIT 1), 'User'::public.app_role),
    u.created_at
  FROM public.users u ORDER BY u.created_at;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'Owner') THEN RAISE EXCEPTION 'Only the owner can change roles'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own role'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'Owner') THEN RAISE EXCEPTION 'Only the owner can delete users'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot delete yourself'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.users WHERE id = _user_id;
END $$;

-- Community tables
ALTER TABLE public.suggestions ADD COLUMN user_id uuid DEFAULT auth.uid();
ALTER TABLE public.bug_reports ADD COLUMN user_id uuid DEFAULT auth.uid();
ALTER TABLE public.bug_reports ADD COLUMN resolution_note text;

CREATE TABLE public.suggestion_votes (
  suggestion_id uuid NOT NULL REFERENCES public.suggestions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (suggestion_id, user_id)
);
GRANT SELECT ON public.suggestion_votes TO authenticated;
GRANT ALL ON public.suggestion_votes TO service_role;
ALTER TABLE public.suggestion_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_votes_read ON public.suggestion_votes FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.upvote_suggestion(_suggestion_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _votes integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to vote'; END IF;
  INSERT INTO public.suggestion_votes (suggestion_id, user_id) VALUES (_suggestion_id, auth.uid());
  UPDATE public.suggestions SET votes = votes + 1 WHERE id = _suggestion_id RETURNING votes INTO _votes;
  RETURN _votes;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'You already voted for this suggestion';
END $$;

DROP POLICY IF EXISTS read_suggestions ON public.suggestions;
DROP POLICY IF EXISTS insert_suggestions ON public.suggestions;
DROP POLICY IF EXISTS update_suggestions ON public.suggestions;
DROP POLICY IF EXISTS delete_suggestions ON public.suggestions;
REVOKE ALL ON public.suggestions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suggestions TO authenticated;
GRANT ALL ON public.suggestions TO service_role;
CREATE POLICY suggestions_read ON public.suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY suggestions_insert ON public.suggestions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (votes = 0 OR public.is_staff(auth.uid())));
CREATE POLICY suggestions_update ON public.suggestions FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY suggestions_delete ON public.suggestions FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS read_bug_reports ON public.bug_reports;
DROP POLICY IF EXISTS insert_bug_reports ON public.bug_reports;
DROP POLICY IF EXISTS update_bug_reports ON public.bug_reports;
DROP POLICY IF EXISTS delete_bug_reports ON public.bug_reports;
REVOKE ALL ON public.bug_reports FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bug_reports TO authenticated;
GRANT ALL ON public.bug_reports TO service_role;
CREATE POLICY bugs_read ON public.bug_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY bugs_insert ON public.bug_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (status = 'open' OR public.is_staff(auth.uid())));
CREATE POLICY bugs_update ON public.bug_reports FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY bugs_delete ON public.bug_reports FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));