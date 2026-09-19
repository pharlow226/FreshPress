const fs = require('fs');

async function fixAudio() {
  const vapiRes = await fetch('https://api.vapi.ai/call/01a0b197-aa59-7eef-8cc0-4d730807f71f', {
    headers: { 'Authorization': 'Bearer 3bb845e1-6d1e-44d5-8850-f5081cab2bb9' }
  });
  const vapiCall = await vapiRes.json();
  const audioUrl = vapiCall.artifact.presignedMonoUrl;

  const audioRes = await fetch(audioUrl);
  const audioBuffer = await audioRes.arrayBuffer();

  const supabaseUrl = 'https://pofiytkpduprbkmgunbg.supabase.co';
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvZml5dGtwZHVwcmJrbWd1bmJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg5NTMzMSwiZXhwIjoyMDg2NDcxMzMxfQ.y0ZHeRNyhfckjexZZnM0IJa9ZgXXo8BO7qaYg3EE5og';
  
  const uploadRes = await fetch(supabaseUrl + '/storage/v1/object/recordings/01a0b197-aa59-7eef-8cc0-4d730807f71f.wav', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + serviceKey,
      'Content-Type': 'audio/wav',
    },
    body: audioBuffer
  });

  console.log('Upload status:', uploadRes.status);

  const publicUrl = supabaseUrl + '/storage/v1/object/public/recordings/01a0b197-aa59-7eef-8cc0-4d730807f71f.wav';

  const patchRes = await fetch(supabaseUrl + '/rest/v1/vapi_call_logs?call_id=eq.01a0b197-aa59-7eef-8cc0-4d730807f71f', {
    method: 'PATCH',
    headers: {
      'apikey': serviceKey,
      'Authorization': 'Bearer ' + serviceKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ recording_url: publicUrl })
  });
  console.log('Patch status:', patchRes.status);
}
fixAudio();
