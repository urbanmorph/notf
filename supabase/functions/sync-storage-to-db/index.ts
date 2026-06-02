import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parse as parseYAML } from 'https://deno.land/std@0.168.0/encoding/yaml.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * One-time sync script: Reads all MD/YAML files from Storage and updates database
 * This ensures MD/YAML (source of truth) and database are in sync
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase admin client
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

    // SECURITY: this endpoint bulk-overwrites DB metadata from Storage across the
    // entire catalogue. Require an authenticated admin (it previously had no role
    // check at all). Mirrors update-file / delete-file.
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
      }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (user.user_metadata?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden', message: 'Admin privileges required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body for options
    const body = req.method === 'POST' ? await req.json() : {}
    // Default to dry-run for safety (must explicitly pass dry_run:false to write).
    const dryRun = body.dry_run !== false
    const fileType = body.file_type || null // 'community' or 'solution-provider' or null for both

    console.log(`Starting sync (dry_run=${dryRun}, file_type=${fileType})...`)

    const results = {
      processed: 0,
      updated: 0,
      created: 0,
      errors: [],
      files: []
    }

    // List all files in communities folder (organized by city)
    if (!fileType || fileType === 'community') {
      // First, list all city folders in communities/
      const { data: cityFolders, error: cityListError } = await supabaseAdmin
        .storage
        .from('notf')
        .list('communities', {
          limit: 1000,
          sortBy: { column: 'name', order: 'asc' }
        })

      if (cityListError) {
        throw new Error(`Failed to list city folders: ${cityListError.message}`)
      }

      // Filter for folders only (they don't have file extensions and no metadata)
      const cities = (cityFolders || []).filter(item =>
        !item.name.endsWith('.md') &&
        !item.name.endsWith('.yaml') &&
        !item.name.endsWith('.yml') &&
        !item.name.endsWith('.json') &&
        !item.name.includes('.') // folders don't have extensions
      )

      console.log(`Found ${cities.length} city folders: ${cities.map(c => c.name).join(', ')}`)

      // For each city, list all community files
      for (const city of cities) {
        const cityName = city.name
        const { data: communityFiles, error: filesError } = await supabaseAdmin
          .storage
          .from('notf')
          .list(`communities/${cityName}`, {
            limit: 1000,
            sortBy: { column: 'name', order: 'asc' }
          })

        if (filesError) {
          console.error(`Error listing files in ${cityName}:`, filesError.message)
          results.errors.push({ path: `communities/${cityName}`, error: filesError.message })
          continue
        }

        console.log(`Found ${communityFiles?.length || 0} files in ${cityName}`)

        for (const file of communityFiles || []) {
          if (!file.name.endsWith('.md') && !file.name.endsWith('.yaml') && !file.name.endsWith('.yml')) {
            continue
          }

          const filePath = `communities/${cityName}/${file.name}`
          const result = await syncFile(supabaseAdmin, filePath, 'community', dryRun)
          results.processed++

          if (result.success) {
            if (result.created) results.created++
            else results.updated++
            results.files.push({ path: filePath, status: 'synced', action: result.created ? 'created' : 'updated' })
          } else {
            results.errors.push({ path: filePath, error: result.error })
          }
        }
      }
    }

    // List all files in solution-providers folder
    if (!fileType || fileType === 'solution-provider') {
      const { data: providerFiles, error: provListError } = await supabaseAdmin
        .storage
        .from('notf')
        .list('solution-providers', {
          limit: 1000,
          sortBy: { column: 'name', order: 'asc' }
        })

      if (provListError) {
        throw new Error(`Failed to list solution provider files: ${provListError.message}`)
      }

      for (const file of providerFiles || []) {
        if (!file.name.endsWith('.md') && !file.name.endsWith('.yaml') && !file.name.endsWith('.yml')) {
          continue
        }

        const filePath = `solution-providers/${file.name}`
        const result = await syncFile(supabaseAdmin, filePath, 'solution-provider', dryRun)
        results.processed++

        if (result.success) {
          if (result.created) results.created++
          else results.updated++
          results.files.push({ path: filePath, status: 'synced', action: result.created ? 'created' : 'updated' })
        } else {
          results.errors.push({ path: filePath, error: result.error })
        }
      }
    }

    console.log(`Sync complete: processed=${results.processed}, updated=${results.updated}, created=${results.created}, errors=${results.errors.length}`)

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        results,
        message: dryRun ? 'Dry run complete - no changes made' : 'Sync complete'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Sync error:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

/**
 * Sync a single file from Storage to database
 */
async function syncFile(
  supabase: any,
  filePath: string,
  fileType: 'community' | 'solution-provider',
  dryRun: boolean
): Promise<{ success: boolean, created?: boolean, error?: string }> {
  try {
    console.log(`Syncing ${filePath}...`)

    // Download file from Storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('notf')
      .download(filePath)

    if (downloadError || !fileData) {
      return { success: false, error: `Download failed: ${downloadError?.message}` }
    }

    // Parse file content
    const content = await fileData.text()
    const metadata = parseFileContent(content, filePath)

    if (!metadata) {
      return { success: false, error: 'Failed to parse file content' }
    }

    // Extract slug from filename
    const slug = filePath.split('/').pop()?.replace(/\.(md|yaml|yml)$/, '') || ''

    // Build database record
    const dbRecord: Record<string, any> = {
      slug,
      file_type: fileType,
      file_path: filePath,
      metadata,
      status: metadata.status || 'active',
      version: metadata.version || 1,
      updated_at: new Date().toISOString()
    }

    // Sync important metadata fields to top-level columns
    if (metadata.city) dbRecord.city = metadata.city
    if (metadata.name) dbRecord.name = metadata.name

    // Handle neighborhoods - store first one for backward compatibility
    if (metadata.neighborhoods && Array.isArray(metadata.neighborhoods) && metadata.neighborhoods.length > 0) {
      dbRecord.neighborhood = metadata.neighborhoods[0]
    } else if (metadata.neighborhood) {
      dbRecord.neighborhood = metadata.neighborhood
    }

    // Handle wards - store first one for backward compatibility
    if (metadata.wards && Array.isArray(metadata.wards) && metadata.wards.length > 0) {
      dbRecord.ward = metadata.wards[0]
    } else if (metadata.ward) {
      dbRecord.ward = metadata.ward
    }

    // Sync location coordinates
    if (metadata.location?.latitude) {
      dbRecord.latitude = metadata.location.latitude
    }
    if (metadata.location?.longitude) {
      dbRecord.longitude = metadata.location.longitude
    }

    if (dryRun) {
      console.log(`[DRY RUN] Would upsert:`, dbRecord)
      return { success: true }
    }

    // Check if record exists
    const { data: existing } = await supabase
      .from('file_metadata')
      .select('file_path')
      .eq('file_path', filePath)
      .single()

    const isCreate = !existing

    // Upsert to database
    const { error: dbError } = await supabase
      .from('file_metadata')
      .upsert(dbRecord, {
        onConflict: 'file_path'
      })

    if (dbError) {
      return { success: false, error: `DB upsert failed: ${dbError.message}` }
    }

    console.log(`✓ Synced ${filePath} (${isCreate ? 'created' : 'updated'})`)
    return { success: true, created: isCreate }

  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Parse file content (MD or YAML)
 */
function parseFileContent(content: string, filePath: string): Record<string, any> | null {
  const isMarkdown = filePath.endsWith('.md')

  try {
    if (isMarkdown) {
      // Parse YAML frontmatter
      if (!content.startsWith('---')) {
        return null
      }

      const parts = content.split('---', 3)
      if (parts.length < 3) {
        return null
      }

      const yamlContent = parts[1]
      return parseYAML(yamlContent) as Record<string, any> || {}
    } else {
      // Parse pure YAML
      return parseYAML(content) as Record<string, any> || {}
    }
  } catch (e) {
    console.error(`Parse error for ${filePath}:`, e)
    return null
  }
}
