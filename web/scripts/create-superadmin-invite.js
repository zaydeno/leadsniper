// Script to create a superadmin bootstrap invite
// Run this AFTER clearing and re-migrating the database
// Usage: node scripts/create-superadmin-invite.js

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
    
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    env[key] = value;
  }
  
  return env;
}

async function createSuperadminInvite() {
  const env = loadEnv();
  
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  // Dynamic import for ES module
  const { createClient } = await import('@supabase/supabase-js');
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('🔍 Checking for existing superadmins...');

  // Check if any superadmins exist
  const { data: superadmins, error: checkError } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('role', 'superadmin')
    .limit(1);

  if (checkError) {
    console.error('❌ Error checking superadmins:', checkError.message);
    process.exit(1);
  }

  if (superadmins && superadmins.length > 0) {
    console.log('⚠️  A superadmin already exists:', superadmins[0].username);
    console.log('   If you want to create a new superadmin invite, clear the database first.');
    process.exit(1);
  }

  console.log('✅ No superadmins found. Creating bootstrap invite...');

  // Generate a secure token
  const token = crypto.randomBytes(24).toString('base64')
    .replace(/\//g, '_')
    .replace(/\+/g, '-');

  // Create the superadmin invite
  const { error: insertError } = await supabase
    .from('invite_tokens')
    .insert({
      token,
      organization_id: null, // Superadmin doesn't belong to an org
      role: 'superadmin',
      created_by: null,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    });

  if (insertError) {
    console.error('❌ Error creating invite:', insertError.message);
    process.exit(1);
  }

  console.log('\n🎉 Superadmin bootstrap invite created successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Token:', token);
  console.log('🔗 Signup URL: http://localhost:3000/signup/' + token);
  console.log('⏰ Expires: 24 hours from now');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('⚡ Use this link to create your superadmin account.');
  console.log('   Then use the Admin panel to create organizations and invite org admins.\n');
}

createSuperadminInvite().catch(console.error);
