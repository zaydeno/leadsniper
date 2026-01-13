const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
}

(async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('Current profiles:');
  const { data: profiles } = await sb.from('profiles').select('*');
  console.log(JSON.stringify(profiles, null, 2));
  
  if (profiles && profiles.length > 0) {
    for (const p of profiles) {
      console.log(`\nForcing ${p.username} (${p.id}) to superadmin...`);
      const { error } = await sb.from('profiles').update({ role: 'superadmin' }).eq('id', p.id);
      if (error) console.log('ERROR:', error.message);
      else console.log('SUCCESS');
    }
  }
  
  console.log('\nVerifying:');
  const { data: after } = await sb.from('profiles').select('id, username, role');
  console.log(JSON.stringify(after, null, 2));
})();

