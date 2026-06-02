import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteFileRequest {
  file_path: string
  file_type?: 'community' | 'solution-provider' | 'story'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Health check endpoint
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({
        status: 'ok',
        version: '2.0-admin-required',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  }

  try {
    // Service-role client (bypasses RLS) for the actual storage + DB operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Anon client bound to the caller's JWT, used only to validate identity
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
      }
    )

    // SECURITY: deletion REQUIRES an authenticated admin. (Previously auth was
    // "optional" here and the function uses the service-role key, which bypasses
    // RLS — so this endpoint was an unauthenticated hard-delete of any file+row.)
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
      console.log(`Delete denied for ${user.email}: role=${user.user_metadata?.role}`)
      return new Response(
        JSON.stringify({ error: 'Forbidden', message: 'Admin privileges required to delete data' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { file_path, file_type }: DeleteFileRequest = await req.json()
    if (!file_path || typeof file_path !== 'string') {
      return new Response(
        JSON.stringify({ error: 'file_path is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Admin ${user.email} requested delete: ${file_path}`)

    // SAFETY: confirm exactly one DB row exists for this path BEFORE deleting
    // anything. This prevents deleting the wrong/non-existent record (storage
    // .remove() of a missing path returns success, so without this check a bad
    // path would still drop a DB row / orphan a file).
    const { data: existingRow, error: lookupError } = await supabaseAdmin
      .from('file_metadata')
      .select('id, file_path, file_type, metadata')
      .eq('file_path', file_path)
      .maybeSingle()

    if (lookupError) {
      throw new Error(`Failed to look up record: ${lookupError.message}`)
    }

    if (!existingRow) {
      return new Response(
        JSON.stringify({ error: 'Not found', message: `No file_metadata row for file_path: ${file_path}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (file_type && existingRow.file_type !== file_type) {
      return new Response(
        JSON.stringify({
          error: 'Type mismatch',
          message: `Refusing to delete: row file_type '${existingRow.file_type}' != requested '${file_type}'`
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Capture a before-image in the response so the caller retains the deleted
    // content (until a dedicated audit table exists).
    const deletedSnapshot = existingRow.metadata

    // Delete the DB row by its immutable id (not the client-supplied path).
    const { error: dbError } = await supabaseAdmin
      .from('file_metadata')
      .delete()
      .eq('id', existingRow.id)

    if (dbError) {
      throw new Error(`Failed to delete database record: ${dbError.message}`)
    }
    console.log(`Database record deleted (id=${existingRow.id}) for ${file_path}`)

    // Then remove the Storage object (best-effort; the row is the source of truth
    // for the public site, and a leftover orphan file is harmless and cleanable).
    const { error: storageError } = await supabaseAdmin
      .storage
      .from('notf')
      .remove([file_path])

    if (storageError) {
      console.error(`Storage delete warning for ${file_path}: ${storageError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        file_path,
        deleted_by: user.email,
        deleted_metadata: deletedSnapshot,
        message: 'File and database record deleted successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error deleting file:', error)

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
