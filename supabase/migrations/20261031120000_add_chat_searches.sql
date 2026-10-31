-- Log of the chatbot's "Find communities" searches: what people typed and what
-- they were shown, so search can be improved from real questions.
--
-- Privacy: no visitor ID, IP address or device details are stored. The browser
-- blanks phone numbers and email addresses before sending (search-log.js), and
-- the checks below refuse any row that still contains one. Anyone can add a
-- row; only active admins can read them. Rows are deleted after 90 days.

CREATE TABLE IF NOT EXISTS public.chat_searches (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   timestamptz NOT NULL DEFAULT now(),
  query        text NOT NULL CHECK (char_length(query) BETWEEN 1 AND 200),
  -- What was shown: [{slug, name, type}], at most the 10 cards the chatbot shows.
  results      jsonb NOT NULL DEFAULT '[]'::jsonb
               CHECK (jsonb_typeof(results) = 'array' AND jsonb_array_length(results) <= 10),
  result_count smallint NOT NULL CHECK (result_count BETWEEN 0 AND 10),
  city         text CHECK (char_length(city) <= 60),
  lang         text CHECK (char_length(lang) <= 5),
  page         text CHECK (char_length(page) <= 100),
  CONSTRAINT chat_searches_no_email CHECK (query !~ '[^[:space:]@]+@[^[:space:]@]+\.'),
  CONSTRAINT chat_searches_no_phone CHECK (query !~ '[0-9][0-9 ().-]{6,}[0-9]')
);

CREATE INDEX IF NOT EXISTS chat_searches_created_at_idx ON public.chat_searches (created_at DESC);

ALTER TABLE public.chat_searches ENABLE ROW LEVEL SECURITY;

-- Supabase grants every privilege on new public tables to the client roles by
-- default; narrow that to adding rows (anyone) and reading them (admins, by RLS).
REVOKE ALL ON public.chat_searches FROM anon, authenticated;
GRANT INSERT (query, results, result_count, city, lang, page) ON public.chat_searches TO anon, authenticated;
GRANT SELECT ON public.chat_searches TO authenticated;

DROP POLICY IF EXISTS "Anyone can log a search" ON public.chat_searches;
CREATE POLICY "Anyone can log a search" ON public.chat_searches
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read searches" ON public.chat_searches;
CREATE POLICY "Admins can read searches" ON public.chat_searches
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users
                 WHERE admin_users.user_id = auth.uid() AND admin_users.is_active = true));

-- Keep 90 days.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule('chat-searches-retention')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'chat-searches-retention');
SELECT cron.schedule(
  'chat-searches-retention',
  '15 3 * * *',
  $$DELETE FROM public.chat_searches WHERE created_at < now() - interval '90 days'$$
);
