// Create superadmin profile for existing auth user
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function createSuperadminProfile() {
  const env = loadEnv();
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('📋 Auth users:\n');
  const { data: authData } = await supabase.auth.admin.listUsers();
  
  if (!authData.users || authData.users.length === 0) {
    console.log('No auth users found.');
    return;
  }

  for (const u of authData.users) {
    console.log(`- ${u.email}`);
    console.log(`  ID: ${u.id}`);
    console.log(`  Metadata: ${JSON.stringify(u.user_metadata)}`);
    console.log();

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', u.id)
      .single();

    if (existingProfile) {
      console.log(`  Profile exists, updating to superadmin...`);
      await supabase.from('profiles').update({ role: 'superadmin' }).eq('id', u.id);
    } else {
      console.log(`  Creating profile as SUPERADMIN...`);
      
      const { error } = await supabase.from('profiles').insert({
        id: u.id,
        email: u.email,
        username: u.user_metadata?.username || u.email.split('@')[0],
        full_name: u.user_metadata?.full_name || u.user_metadata?.username,
        role: 'superadmin',
        organization_id: null,
      });

      if (error) {
        console.log(`  ❌ Error: ${error.message}`);
      } else {
        console.log(`  ✅ Profile created as superadmin!`);
      }
    }
  }

  console.log('\n⚡ Please refresh your browser and log in again.');
}

createSuperadminProfile().catch(console.error);

