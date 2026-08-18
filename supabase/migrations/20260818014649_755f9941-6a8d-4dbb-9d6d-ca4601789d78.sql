CREATE TABLE public.badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  serial integer NOT NULL UNIQUE,
  token text NOT NULL UNIQUE,
  codec text NOT NULL DEFAULT 'hmac-v1',
  batch text NOT NULL DEFAULT 'batch-1',
  revoked boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.attendees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  badge_id uuid NOT NULL UNIQUE REFERENCES public.badges(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  organization text,
  designation text,
  ticket_type text NOT NULL DEFAULT 'attendee',
  checked_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_badges_serial ON public.badges (serial);
CREATE INDEX idx_attendees_badge ON public.attendees (badge_id);

GRANT ALL ON public.badges TO service_role;
GRANT ALL ON public.attendees TO service_role;

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER attendees_touch_updated_at
BEFORE UPDATE ON public.attendees
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();