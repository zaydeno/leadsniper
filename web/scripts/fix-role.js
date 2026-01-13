// Fix user role and diagnose the trigger issue
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

async function fixRole() {
  const env = loadEnv();
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('🔍 Finding users with sales role...\n');

  const { data: salesUsers, error } = await supabase
    .from('profiles')
    .select('id, username, email, role')
    .eq('role', 'sales');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  if (!salesUsers || salesUsers.length === 0) {
    console.log('No sales users found.');
    return;
  }

  for (const user of salesUsers) {
    console.log(`Found: ${user.username} (${user.email}) - currently: ${user.role}`);
  }

  // Update the most recent user to superadmin
  const userToFix = salesUsers[salesUsers.length - 1];
  
  console.log(`\n🔧 Updating ${userToFix.username} to superadmin...`);

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'superadmin' })
    .eq('id', userToFix.id);

  if (updateError) {
    console.error('❌ Update error:', updateError.message);
    return;
  }

  console.log('✅ Role updated to superadmin!');
  
  // Verify
  const { data: updated } = await supabase
    .from('profiles')
    .select('username, role')
    .eq('id', userToFix.id)
    .single();

  console.log(`\n📋 Verified: ${updated.username} is now ${updated.role}`);
  console.log('\n⚡ Please refresh your browser and log in again.');
}

fixRole().catch(console.error);

