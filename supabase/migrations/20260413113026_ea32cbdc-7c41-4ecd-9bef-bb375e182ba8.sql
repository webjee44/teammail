
-- Add sequential number column
ALTER TABLE public.conversations ADD COLUMN seq_number integer;

-- Populate existing conversations with sequential numbers per team
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY created_at) AS rn
  FROM public.conversations
)
UPDATE public.conversations c
SET seq_number = n.rn
FROM numbered n
WHERE c.id = n.id;

-- Make it NOT NULL after populating
ALTER TABLE public.conversations ALTER COLUMN seq_number SET NOT NULL;

-- Add unique constraint per team
ALTER TABLE public.conversations ADD CONSTRAINT conversations_team_seq_unique UNIQUE (team_id, seq_number);

-- Create function to auto-assign next seq_number
CREATE OR REPLACE FUNCTION public.assign_conversation_seq_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT COALESCE(MAX(seq_number), 0) + 1
  INTO NEW.seq_number
  FROM public.conversations
  WHERE team_id = NEW.team_id;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trg_assign_conversation_seq
BEFORE INSERT ON public.conversations
FOR EACH ROW
WHEN (NEW.seq_number IS NULL)
EXECUTE FUNCTION public.assign_conversation_seq_number();
