
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
const supabase = createClient('https://pofiytkpduprbkmgunbg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvZml5dGtwZHVwcmJrbWd1bmJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTUzMzEsImV4cCI6MjA4NjQ3MTMzMX0.z1ULHZ-AlolS-nInaiWZ6YWDqMtN3SYeRyYZ59y_cJE');
const { data, error } = await supabase.from('chat_messages').select('role, content, created_at').eq('session_id', 'TEST_SESSION_555').order('created_at', { ascending: true }).limit(50);
console.log('DATA:', data);
console.log('ERROR:', error);
