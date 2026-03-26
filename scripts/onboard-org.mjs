#!/usr/bin/env node

/**
 * Onboard a new customer organization.
 *
 * Creates a Clerk Organization, adds an admin user, and inserts the
 * matching Brand record in the database so the multi-tenant auth flow
 * works end-to-end.
 *
 * Usage:
 *   pnpm onboard-org --name "EZCorp" --admin-email "admin@ezcorp.com"
 *
 * Required env vars:
 *   CLERK_SECRET_KEY  — Clerk production secret key
 *   DATABASE_URL      — PostgreSQL connection string
 */

import { parseArgs } from 'node:util'

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const { values } = parseArgs({
  options: {
    name: { type: 'string', short: 'n' },
    'admin-email': { type: 'string', short: 'e' },
    help: { type: 'boolean', short: 'h' },
  },
  strict: true,
})

if (values.help || !values.name) {
  console.log(`
Usage: pnpm onboard-org --name "Org Name" [--admin-email "user@example.com"]

Options:
  --name, -n          Organization name (required)
  --admin-email, -e   Email of the admin user to add (optional — will be
                      invited if not already a Clerk user)
  --help, -h          Show this help message

Required environment variables:
  CLERK_SECRET_KEY    Clerk production secret key
  DATABASE_URL        PostgreSQL connection string

Examples:
  pnpm onboard-org --name "EZCorp" --admin-email "admin@ezcorp.com"
  pnpm onboard-org --name "Acme Inc"
`)
  process.exit(values.help ? 0 : 1)
}

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY
const DATABASE_URL = process.env.DATABASE_URL

if (!CLERK_SECRET_KEY) {
  console.error('Error: CLERK_SECRET_KEY environment variable is required')
  process.exit(1)
}
if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required')
  process.exit(1)
}

const orgName = values.name
const adminEmail = values['admin-email']

// ---------------------------------------------------------------------------
// Clerk API helpers
// ---------------------------------------------------------------------------

const CLERK_API = 'https://api.clerk.com/v1'

async function clerkFetch(path, options = {}) {
  const res = await fetch(`${CLERK_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const body = await res.json()
  if (!res.ok) {
    const msg = body.errors?.[0]?.long_message || body.errors?.[0]?.message || JSON.stringify(body)
    throw new Error(`Clerk API ${path} failed (${res.status}): ${msg}`)
  }
  return body
}

async function findUserByEmail(email) {
  const users = await clerkFetch(`/users?email_address=${encodeURIComponent(email)}`)
  return users[0] ?? null
}

async function createOrganization(name, createdBy) {
  return clerkFetch('/organizations', {
    method: 'POST',
    body: JSON.stringify({ name, created_by: createdBy }),
  })
}

async function addOrgMember(orgId, userId, role) {
  return clerkFetch(`/organizations/${orgId}/memberships`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role }),
  })
}

async function inviteToOrg(orgId, email, role) {
  return clerkFetch(`/organizations/${orgId}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ email_address: email, role }),
  })
}

// ---------------------------------------------------------------------------
// Database helper (raw SQL via PrismaClient to avoid build dependency)
// ---------------------------------------------------------------------------

async function createBrandRecord(name, clerkOrgId) {
  // Resolve @prisma/client from the database package where it's installed
  const { createRequire } = await import('node:module')
  const { fileURLToPath } = await import('node:url')
  const { join, dirname } = await import('node:path')

  // Try multiple resolution paths
  const paths = [
    join(process.cwd(), 'packages', 'database', 'node_modules', '@prisma', 'client'),
    join(process.cwd(), 'node_modules', '@prisma', 'client'),
  ]

  let PrismaClient
  for (const p of paths) {
    try {
      const mod = await import(p)
      PrismaClient = mod.PrismaClient
      break
    } catch {
      continue
    }
  }

  if (!PrismaClient) {
    // Fallback to raw SQL via prisma CLI
    const { execSync } = await import('node:child_process')
    const cuid = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    const sql = `INSERT INTO brands (id, "clerkOrgId", name, "createdAt") VALUES ('${cuid}', '${clerkOrgId}', '${name.replace(/'/g, "''")}', NOW()) RETURNING id, name, "clerkOrgId";`
    execSync(
      `npx prisma db execute --stdin`,
      {
        input: sql,
        cwd: join(process.cwd(), 'packages', 'database'),
        env: { ...process.env, DATABASE_URL },
        stdio: ['pipe', 'inherit', 'inherit'],
      },
    )
    return { id: cuid, name, clerkOrgId }
  }

  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL })
  try {
    return await prisma.brand.create({ data: { name, clerkOrgId } })
  } finally {
    await prisma.$disconnect()
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nOnboarding organization: ${orgName}`)
  console.log('─'.repeat(50))

  // Step 1: Find or identify the creator user
  let creatorId = null
  if (adminEmail) {
    console.log(`\n1. Looking up admin user: ${adminEmail}`)
    const user = await findUserByEmail(adminEmail)
    if (user) {
      console.log(`   Found user: ${user.id} (${user.first_name} ${user.last_name})`)
      creatorId = user.id
    } else {
      console.log(`   User not found — will send invitation after org creation`)
    }
  } else {
    // Use the first user in the system as creator
    console.log('\n1. No admin email specified — using first available user as creator')
    const users = await clerkFetch('/users?limit=1')
    if (users.length === 0) {
      throw new Error('No users found in Clerk. Create a user first.')
    }
    creatorId = users[0].id
    console.log(`   Using: ${users[0].id} (${users[0].first_name} ${users[0].last_name})`)
  }

  // Step 2: Create the Clerk Organization
  console.log(`\n2. Creating Clerk Organization: "${orgName}"`)
  let org
  if (creatorId) {
    org = await createOrganization(orgName, creatorId)
  } else {
    // Can't create without a creator — use first user, then invite the admin
    const users = await clerkFetch('/users?limit=1')
    if (users.length === 0) throw new Error('No users found in Clerk.')
    org = await createOrganization(orgName, users[0].id)
  }
  console.log(`   Org created: ${org.id}`)

  // Step 3: Add/invite the admin user if needed
  if (adminEmail && !creatorId) {
    console.log(`\n3. Inviting ${adminEmail} as org admin`)
    const invite = await inviteToOrg(org.id, adminEmail, 'org:admin')
    console.log(`   Invitation sent: ${invite.id}`)
  } else if (adminEmail && creatorId) {
    console.log(`\n3. Admin ${adminEmail} is already the org creator (auto-added as admin)`)
  } else {
    console.log(`\n3. No admin email — skipping invitation`)
  }

  // Step 4: Create the Brand record in the database
  console.log(`\n4. Creating Brand record in database`)
  const brand = await createBrandRecord(orgName, org.id)
  console.log(`   Brand created: ${brand.id}`)

  // Summary
  console.log('\n' + '─'.repeat(50))
  console.log('Onboarding complete!\n')
  console.log(`  Organization:  ${orgName}`)
  console.log(`  Clerk Org ID:  ${org.id}`)
  console.log(`  Brand ID:      ${brand.id}`)
  if (adminEmail) {
    console.log(`  Admin:         ${adminEmail}`)
  }
  console.log(`\n  The admin can now sign in at your production URL`)
  console.log(`  and will see this organization's data.\n`)
}

main().catch((err) => {
  console.error('\nOnboarding failed:', err.message)
  process.exit(1)
})
