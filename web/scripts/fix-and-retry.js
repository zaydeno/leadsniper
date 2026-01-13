// Script to fix database issues and recreate superadmin invite
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local file not found');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function fixAndRetry() {
  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('🔍 Checking for orphan profiles...');
  
  // Check for profiles without matching auth users
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, email');
  
  if (profilesError) {
    console.error('❌ Error fetching profiles:', profilesError.message);
  } else if (profiles && profiles.length > 0) {
    console.log(`   Found ${profiles.length} profile(s):`);
    for (const p of profiles) {
      console.log(`   - ${p.username} (${p.email})`);
    }
    
    console.log('\n🗑️  Deleting orphan profiles...');
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (deleteError) {
      console.error('❌ Error deleting profiles:', deleteError.message);
    } else {
      console.log('✅ Profiles cleared');
    }
  } else {
    console.log('   No orphan profiles found');
  }

  // Clear invite tokens
  console.log('\n🗑️  Clearing invite tokens...');
  await supabase.from('invite_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  // Create new superadmin invite
  console.log('\n📝 Creating new superadmin invite...');
  const token = crypto.randomBytes(24).toString('base64').replace(/\//g, '_').replace(/\+/g, '-');
  
  const { error: insertError } = await supabase.from('invite_tokens').insert({
    token,
    organization_id: null,
    role: 'superadmin',
    created_by: null,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  if (insertError) {
    console.error('❌ Error creating invite:', insertError.message);
    process.exit(1);
  }

  console.log('\n🎉 Done!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔗 Signup URL: http://localhost:3000/signup/' + token);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

fixAndRetry().catch(console.error);

