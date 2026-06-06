import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parse as parseYAML, stringify as stringifyYAML } from 'https://deno.land/std@0.168.0/encoding/yaml.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { isAuthorizedAdmin } from '../_shared/auth.ts'
import { generateMarkdownFile, mergeUpdates, parseMarkdownFile } from '../_shared/file-ops.ts'

interface UpdateFileRequest {
  file_path: string
  file_type: 'community' | 'solution-provider'
  updates: Record<string, any>
  markdown_body?: string  // For .md files only
  version?: number  // For optimistic locking
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Health check endpoint
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({
        status: 'ok',
        version: '4.4-admin-users-auth',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  }

  try {
    // Create Supabase admin client with service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Create client with anon key for user JWT validation
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') ?? ''
          }
        }
      }
    )

    // SECURITY: Authentication is REQUIRED
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      console.log('Missing authorization header')
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser()

    if (authError || !user) {
      console.log('Authentication failed:', authError?.message || 'No user')
      return new Response(
        JSON.stringify({ error: 'Invalid or expired authentication token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // SECURITY: authorize via the admin_users registry (active membership),
    // honouring the legacy user_metadata.role === 'admin' flag too. Uses the
    // service-role client so the lookup is not subject to RLS.
    const authorized = await isAuthorizedAdmin(supabaseAdmin, user)

    if (!authorized) {
      console.log(`Access denied for user ${user.email}: not an active admin`)
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'Admin privileges required to modify data'
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Authenticated admin user: ${user.email}`)

    // Parse request body
    const { file_path, file_type, updates, markdown_body, version }: UpdateFileRequest = await req.json()

    console.log(`Updating file: ${file_path}`)

    // Determine file extension
    const isMarkdown = file_path.endsWith('.md')
    const isYAML = file_path.endsWith('.yaml') || file_path.endsWith('.yml')

    if (!isMarkdown && !isYAML) {
      throw new Error(`Unsupported file extension: ${file_path}`)
    }

    // Try to download current file from Storage
    const { data: fileData, error: downloadError } = await supabaseAdmin
      .storage
      .from('notf')
      .download(file_path)

    let currentData: Record<string, any> = {}
    let existingMarkdownBody = ''
    let fileExists = false

    if (!downloadError && fileData) {
      // File exists - parse it
      fileExists = true
      const currentContent = await fileData.text()

      // Parse file based on format
      if (isMarkdown) {
        // Parse YAML frontmatter + markdown body
        const result = parseMarkdownFile(currentContent)
        currentData = result.frontmatter
        existingMarkdownBody = result.body
      } else {
        // Parse pure YAML
        currentData = parseYAML(currentContent) as Record<string, any> || {}
      }
    } else {
      // File doesn't exist in Storage. This is NOT necessarily a fresh create:
      // public submissions (join form, chatbot onboarding) insert directly into
      // the file_metadata table and never write a Storage file. For those
      // records the rich metadata lives only in the DB row. If we merged into an
      // empty object here, a status-only update (e.g. admin approval sending
      // { status: 'active' }) would overwrite metadata with just the status and
      // wipe name/themes/description/contact/etc. So seed currentData from the
      // existing DB row's metadata, which both prevents the wipe and backfills
      // the missing Storage file with full content.
      console.log(`File missing in Storage: ${file_path}. Checking DB for existing metadata...`)
      const { data: existingRow } = await supabaseAdmin
        .from('file_metadata')
        .select('metadata')
        .eq('file_path', file_path)
        .maybeSingle()

      if (
        existingRow?.metadata &&
        typeof existingRow.metadata === 'object' &&
        !Array.isArray(existingRow.metadata)
      ) {
        currentData = existingRow.metadata as Record<string, any>
        console.log(`Seeded currentData from existing DB row (${Object.keys(currentData).length} keys)`)
      } else {
        console.log(`No existing DB metadata; treating as fresh create: ${file_path}`)
        currentData = {}
      }
    }

    // Optimistic locking: Check version if provided
    if (version !== undefined && currentData.version !== version) {
      return new Response(
        JSON.stringify({
          error: 'Conflict detected',
          message: 'This file was modified by another user. Please refresh and try again.',
          currentVersion: currentData.version
        }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Merge updates with existing data (preserves unedited fields)
    const mergedData = mergeUpdates(currentData, updates)

    // Auto-update metadata
    mergedData.last_updated = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    mergedData.version = (currentData.version || 0) + 1

    // Regenerate file content
    let updatedContent: string

    if (isMarkdown) {
      // Use provided markdown_body or preserve existing
      const bodyToUse = markdown_body !== undefined ? markdown_body : existingMarkdownBody
      updatedContent = generateMarkdownFile(mergedData, bodyToUse)
    } else {
      updatedContent = stringifyYAML(mergedData)
    }

    // Upload updated file to Storage
    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('notf')
      .upload(file_path, updatedContent, {
        contentType: isMarkdown ? 'text/markdown' : 'application/x-yaml',
        upsert: true
      })

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`)
    }

    console.log(`File uploaded successfully: ${file_path}`)

    // Extract metadata for database
    const slug = file_path.split('/').pop()?.replace(/\.(md|yaml|yml)$/, '') || ''

    // Build database update
    const dbUpdate: Record<string, any> = {
      slug,
      file_type,
      file_path,
      metadata: mergedData,
      status: mergedData.status || 'active',
      version: mergedData.version,
      updated_at: new Date().toISOString()
    }

    // Add user tracking if authenticated
    if (user) {
      dbUpdate.updated_by = user.id
      if (!fileExists) {
        dbUpdate.created_by = user.id
      }
    }

    // Sync important metadata fields to top-level database columns for indexing/filtering
    // Pull from metadata (source of truth), not from file path
    if (mergedData.city) {
      dbUpdate.city = mergedData.city
    }

    // Handle neighborhoods - store first one in singular 'neighborhood' column for backward compatibility
    if (mergedData.neighborhoods && Array.isArray(mergedData.neighborhoods) && mergedData.neighborhoods.length > 0) {
      dbUpdate.neighborhood = mergedData.neighborhoods[0]
    } else if (mergedData.neighborhood) {
      dbUpdate.neighborhood = mergedData.neighborhood
    }

    // Handle wards - store first one in singular 'ward' column for backward compatibility
    if (mergedData.wards && Array.isArray(mergedData.wards) && mergedData.wards.length > 0) {
      dbUpdate.ward = mergedData.wards[0]
    } else if (mergedData.ward) {
      dbUpdate.ward = mergedData.ward
    }

    // Sync location coordinates
    if (mergedData.location?.latitude) {
      dbUpdate.latitude = mergedData.location.latitude
    }
    if (mergedData.location?.longitude) {
      dbUpdate.longitude = mergedData.location.longitude
    }

    // Sync name for easier querying
    if (mergedData.name) {
      dbUpdate.name = mergedData.name
    }

    // Upsert to database
    const { error: dbError } = await supabaseAdmin
      .from('file_metadata')
      .upsert(dbUpdate, {
        onConflict: 'file_path'
      })

    if (dbError) {
      throw new Error(`Failed to update database: ${dbError.message}`)
    }

    console.log(`Database updated successfully for ${slug}`)

    return new Response(
      JSON.stringify({
        success: true,
        file_path,
        slug,
        version: mergedData.version,
        message: 'File and database updated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error updating file:', error)

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
