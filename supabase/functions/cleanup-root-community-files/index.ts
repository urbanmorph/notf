import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Cleanup helper: deletes ONLY orphaned MD/YAML files from the root communities/
 * folder — files that are NOT referenced by any row in file_metadata.
 *
 * IMPORTANT: Root-level paths (communities/<slug>.md) are LEGITIMATE. The public
 * join form and chatbot onboarding insert DB-first records whose file_path is
 * communities/<slug>.md, and update-file backfills the Storage file at exactly
 * that path on approval. So this function must never blindly delete root files —
 * doing so would destroy the source-of-truth Storage file for a live community
 * and re-open the "Storage missing" metadata-wipe hazard. It therefore checks
 * file_metadata for each file and skips any that are still referenced.
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase admin client (service role) for storage + DB operations
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

    // Client with anon key for validating the caller's JWT
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
      }
    )

    // SECURITY: require an authenticated admin (this is a destructive operation)
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
    const dryRun = body.dry_run !== false // Default to dry run for safety

    console.log(`Starting orphan cleanup (dry_run=${dryRun}) for admin ${user.email}...`)

    const results = {
      deleted: 0,
      skipped_referenced: 0,
      errors: [] as Array<{ path: string, error: string }>,
      files: [] as Array<{ path: string, status: string }>
    }

    // List all files in root communities folder
    const { data: files, error: listError } = await supabaseAdmin
      .storage
      .from('notf')
      .list('communities', {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' }
      })

    if (listError) {
      throw new Error(`Failed to list files: ${listError.message}`)
    }

    // Filter for MD/YAML files only (not folders)
    const filesToDelete = (files || []).filter(file =>
      file.name.endsWith('.md') ||
      file.name.endsWith('.yaml') ||
      file.name.endsWith('.yml')
    )

    console.log(`Found ${filesToDelete.length} candidate files in root communities/ folder`)

    for (const file of filesToDelete) {
      const filePath = `communities/${file.name}`

      // SAFETY: never delete a file that a live file_metadata row points at.
      const { data: refRow, error: refError } = await supabaseAdmin
        .from('file_metadata')
        .select('id')
        .eq('file_path', filePath)
        .maybeSingle()

      if (refError) {
        console.error(`Skipping ${filePath} — could not verify references: ${refError.message}`)
        results.errors.push({ path: filePath, error: `reference check failed: ${refError.message}` })
        continue
      }

      if (refRow) {
        console.log(`Skipping ${filePath} — referenced by a live file_metadata row`)
        results.skipped_referenced++
        results.files.push({ path: filePath, status: 'skipped_referenced' })
        continue
      }

      if (dryRun) {
        console.log(`[DRY RUN] Would delete orphan: ${filePath}`)
        results.files.push({ path: filePath, status: 'would_delete' })
      } else {
        try {
          const { error: deleteError } = await supabaseAdmin
            .storage
            .from('notf')
            .remove([filePath])

          if (deleteError) {
            console.error(`Failed to delete ${filePath}:`, deleteError.message)
            results.errors.push({ path: filePath, error: deleteError.message })
          } else {
            console.log(`✓ Deleted orphan ${filePath}`)
            results.deleted++
            results.files.push({ path: filePath, status: 'deleted' })
          }
        } catch (error) {
          console.error(`Error deleting ${filePath}:`, error.message)
          results.errors.push({ path: filePath, error: error.message })
        }
      }
    }

    console.log(`Cleanup complete: deleted=${results.deleted}, skipped=${results.skipped_referenced}, errors=${results.errors.length}`)

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        results,
        message: dryRun
          ? `Dry run complete - ${results.files.filter(f => f.status === 'would_delete').length} orphan(s) would be deleted, ${results.skipped_referenced} referenced file(s) skipped`
          : `Cleanup complete - deleted ${results.deleted} orphan(s), skipped ${results.skipped_referenced} referenced file(s)`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Cleanup error:', error)

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
