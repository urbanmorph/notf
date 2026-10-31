import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { isAuthorizedAdmin } from '../_shared/auth.ts'
import { checkChange, checkInvite } from '../_shared/admin-rules.ts'

// NOTF admins manage admins and viewers from the admin panel:
//   {action: 'list'}                                  everyone with NOTF access, and super admins
//   {action: 'invite', email, name, notf_role}        email an invitation; add or update their row
//   {action: 'update', id, notf_role?, is_active?}    change role / deactivate / reactivate
// Only NOTF admins may call it. Super admins (scripts/add-super-admin.sh) and the
// caller's own row cannot be changed here (see _shared/admin-rules.ts).

const RESET_PAGE = 'https://www.notf.in/admin/reset-password.html'

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method === 'GET') {
    return reply({ status: 'ok', version: '1.0-notf-roles', timestamp: new Date().toISOString() })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
      }
    )

    if (!req.headers.get('Authorization')) return reply({ error: 'Authentication required' }, 401)
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser()
    if (authError || !user) return reply({ error: 'Invalid or expired authentication token' }, 401)
    if (!(await isAuthorizedAdmin(supabaseAdmin, user))) {
      return reply({ error: 'Forbidden', message: 'Only NOTF admins can manage admins.' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const COLUMNS = 'id, user_id, name, email, role, notf_role, is_active, created_at'

    if (body.action === 'list') {
      const { data: rows, error } = await supabaseAdmin
        .from('admin_users')
        .select(COLUMNS)
        .or('notf_role.not.is.null,role.eq.super_admin')
        .order('created_at')
      if (error) throw error
      // Last sign-in comes from Auth; one page covers this project's accounts.
      const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
      const signIns = new Map((users?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]))
      return reply({
        me: user.id,
        admins: (rows ?? []).map((r) => ({ ...r, last_sign_in_at: signIns.get(r.user_id) ?? null }))
      })
    }

    if (body.action === 'invite') {
      const checked = checkInvite(body)
      if (!checked.ok) return reply({ error: checked.error }, 400)
      const { email, name, notf_role } = checked.value

      // Invite a new account, or find the existing one (they can use
      // "Forgot password?" to set a password).
      let userId: string | null = null
      let invited = false
      const { data: inv, error: invError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email, { redirectTo: RESET_PAGE }
      )
      if (inv?.user) {
        userId = inv.user.id
        invited = true
      } else {
        const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
        userId = users?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null
        if (!userId) return reply({ error: invError?.message ?? 'Could not invite this email.' }, 400)
      }

      const { data: existing } = await supabaseAdmin
        .from('admin_users').select('id, user_id, role').eq('user_id', userId).maybeSingle()
      if (existing) {
        const refusal = checkChange({ user_id: user.id }, existing, { notf_role, is_active: true })
        if (refusal) return reply({ error: refusal }, 400)
        const { error } = await supabaseAdmin.from('admin_users')
          .update({ notf_role, is_active: true, updated_at: new Date().toISOString() }).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabaseAdmin.from('admin_users')
          .insert({ user_id: userId, email, name, notf_role, is_active: true })
        if (error) throw error
      }
      console.log(`${user.email} gave ${email} NOTF ${notf_role} access (invited: ${invited})`)
      return reply({ ok: true, invited })
    }

    if (body.action === 'update') {
      const change: Record<string, unknown> = {}
      if ('notf_role' in body) change.notf_role = body.notf_role
      if ('is_active' in body) change.is_active = body.is_active
      const { data: target } = await supabaseAdmin
        .from('admin_users').select('id, user_id, role, email').eq('id', String(body.id ?? '')).maybeSingle()
      if (!target) return reply({ error: 'No such admin.' }, 404)
      const refusal = checkChange({ user_id: user.id }, target, change)
      if (refusal) return reply({ error: refusal }, 400)
      const { error } = await supabaseAdmin.from('admin_users')
        .update({ ...change, updated_at: new Date().toISOString() }).eq('id', target.id)
      if (error) throw error
      console.log(`${user.email} changed ${target.email}: ${JSON.stringify(change)}`)
      return reply({ ok: true })
    }

    return reply({ error: "Unknown action. Use 'list', 'invite' or 'update'." }, 400)
  } catch (error) {
    console.error('manage-admins failed:', error)
    return reply({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
