// Script to reset all users and create a fresh superadmin invite
// Usage: node scripts/reset-and-create-superadmin.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Manually load .env.local
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

async function resetAndCreateSuperadmin() {
  const env = loadEnv();
  
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const { createClient } = await import('@supabase/supabase-js');
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('🗑️  Clearing all users...\n');

  // Get all users from auth.users
  const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('❌ Error listing users:', listError.message);
    process.exit(1);
  }

  // Delete each user (this cascades to profiles due to FK)
  for (const user of authUsers.users) {
    console.log(`   Deleting user: ${user.email}`);
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error(`   ⚠️ Failed to delete ${user.email}:`, deleteError.message);
    }
  }

  console.log(`\n✅ Deleted ${authUsers.users.length} users`);

  // Clear all invite tokens
  console.log('\n🗑️  Clearing all invite tokens...');
  const { error: clearInvitesError } = await supabase
    .from('invite_tokens')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (clearInvitesError) {
    console.error('⚠️ Error clearing invites:', clearInvitesError.message);
  } else {
    console.log('✅ Cleared all invite tokens');
  }

  // Generate a secure token for superadmin
  console.log('\n📝 Creating superadmin invite...');
  
  const token = crypto.randomBytes(24).toString('base64')
    .replace(/\//g, '_')
    .replace(/\+/g, '-');

  const { error: insertError } = await supabase
    .from('invite_tokens')
    .insert({
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

  console.log('\n🎉 Database reset complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Superadmin Token:', token);
  console.log('🔗 Signup URL: http://localhost:3000/signup/' + token);
  console.log('⏰ Expires: 24 hours from now');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('⚡ Use this link to create your superadmin account.\n');
}

resetAndCreateSuperadmin().catch(console.error);

