CREATE OR REPLACE FUNCTION assign_pickup_staff()
RETURNS TABLE (id uuid, full_name text, email text)
LANGUAGE plpgsql
AS $$
DECLARE
  assigned_record RECORD;
BEGIN
  -- Find the least recently assigned available staff member and lock the row
  SELECT s.id, s.full_name, s.email INTO assigned_record
  FROM staff_members s
  WHERE s.role = 'pickup' 
    AND s.active = true 
    AND s.availability_status = 'available'
  ORDER BY s.last_assigned_at ASC NULLS FIRST
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If we found someone, update their assignment time
  IF FOUND THEN
    UPDATE staff_members
    SET last_assigned_at = now()
    WHERE staff_members.id = assigned_record.id;
    
    RETURN QUERY SELECT assigned_record.id, assigned_record.full_name, assigned_record.email;
  END IF;
END;
$$;
