// Check all users and their roles
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

async function checkUsers() {
  const env = loadEnv();
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('📋 All profiles:\n');

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, email, role, organization_id');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  if (!profiles || profiles.length === 0) {
    console.log('No profiles found.');
    return;
  }

  for (const p of profiles) {
    console.log(`- ${p.username || 'no-username'}`);
    console.log(`  Email: ${p.email}`);
    console.log(`  Role: ${p.role}`);
    console.log(`  Org: ${p.organization_id || 'none'}`);
    console.log();
  }

  // Also check auth users
  console.log('📋 Auth users:\n');
  const { data: authData } = await supabase.auth.admin.listUsers();
  
  for (const u of authData.users) {
    console.log(`- ${u.email}`);
    console.log(`  Metadata role: ${u.user_metadata?.role || 'not set'}`);
    console.log();
  }
}

checkUsers().catch(console.error);

