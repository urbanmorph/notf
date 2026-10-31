// Admins page: NOTF admins invite admins and viewers, change their access, and
// deactivate or reactivate them, through the manage-admins Edge Function (which
// enforces the same rules: no super admins, not yourself).

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const ACCESS_LABEL = { admin: 'Admin', viewer: 'Viewer' };

// Call manage-admins; throw the function's own error message on failure.
async function manageAdmins(body) {
    const { data, error } = await authUtils.supabase.functions.invoke('manage-admins', { body });
    if (error) {
        const detail = await error.context?.json?.().catch(() => null);
        throw new Error(detail?.error || detail?.message || error.message || 'Request failed');
    }
    return data;
}

function formatDate(iso) {
    return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'never';
}

function renderAdmins(admins, me) {
    document.getElementById('adminCount').textContent = `(${admins.length})`;
    const list = document.getElementById('adminList');
    if (!admins.length) {
        list.innerHTML = '<p class="empty">No admins yet.</p>';
        return;
    }
    list.innerHTML = admins.map((a) => {
        const isSuper = a.role === 'super_admin';
        const isMe = a.user_id === me;
        const locked = isSuper || isMe;
        const access = isSuper ? 'Super admin' : (ACCESS_LABEL[a.notf_role] || 'No access');
        const controls = locked
            ? `<span class="admin-locked">${isMe ? 'You' : 'Managed by script'}</span>`
            : `<label class="sr-only" for="role-${escapeHtml(a.id)}">Access for ${escapeHtml(a.name)}</label>
               <select id="role-${escapeHtml(a.id)}" data-action="role" data-id="${escapeHtml(a.id)}">
                   <option value="viewer" ${a.notf_role === 'viewer' ? 'selected' : ''}>Viewer</option>
                   <option value="admin" ${a.notf_role === 'admin' ? 'selected' : ''}>Admin</option>
               </select>
               <button type="button" class="btn-secondary" data-action="active" data-id="${escapeHtml(a.id)}" data-active="${!a.is_active}">
                   ${a.is_active ? 'Deactivate' : 'Reactivate'}
               </button>`;
        return `
            <div class="org-card minimal admin-row ${a.is_active ? '' : 'is-inactive'}">
                <div class="org-info">
                    <h3>${escapeHtml(a.name)} ${a.is_active ? '' : '<span class="status-indicator archived">inactive</span>'}</h3>
                    <div class="org-meta">
                        <span><i class="fa-solid fa-envelope"></i> ${escapeHtml(a.email)}</span>
                        <span><i class="fa-solid fa-user-tag"></i> ${escapeHtml(access)}</span>
                        <span><i class="fa-solid fa-clock"></i> Last sign-in: ${escapeHtml(formatDate(a.last_sign_in_at))}</span>
                    </div>
                </div>
                <div class="card-actions admin-controls">${controls}</div>
            </div>`;
    }).join('');
}

async function loadAdmins() {
    const list = document.getElementById('adminList');
    try {
        const { admins, me } = await manageAdmins({ action: 'list' });
        renderAdmins(admins, me);
    } catch (error) {
        list.innerHTML = `<p class="error-message">Could not load admins: ${escapeHtml(error.message)}</p>`;
    }
}

async function updateAdmin(id, change, control) {
    control.disabled = true;
    try {
        await manageAdmins({ action: 'update', id, ...change });
    } catch (error) {
        alertInline(error.message);
    }
    await loadAdmins();
}

// Show a message under the invite form (no browser dialogs).
function alertInline(message) {
    document.getElementById('inviteStatus').textContent = message;
}

(async function() {
    const session = await authUtils.requireAuth();
    if (!session) return;
    if (authUtils.role !== 'admin') {
        document.getElementById('inviteForm').hidden = true;
        document.getElementById('adminList').innerHTML = '<p class="empty">Only NOTF admins can manage admins.</p>';
        return;
    }

    document.getElementById('refreshBtn').addEventListener('click', loadAdmins);

    document.getElementById('adminList').addEventListener('change', (e) => {
        const select = e.target.closest('select[data-action="role"]');
        if (select) updateAdmin(select.dataset.id, { notf_role: select.value }, select);
    });
    document.getElementById('adminList').addEventListener('click', (e) => {
        const button = e.target.closest('button[data-action="active"]');
        if (button) updateAdmin(button.dataset.id, { is_active: button.dataset.active === 'true' }, button);
    });

    document.getElementById('inviteForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = document.getElementById('inviteBtn');
        const email = document.getElementById('inviteEmail').value.trim();
        button.disabled = true;
        alertInline('');
        try {
            const result = await manageAdmins({
                action: 'invite',
                name: document.getElementById('inviteName').value.trim(),
                email,
                notf_role: document.getElementById('inviteRole').value,
            });
            alertInline(result.invited
                ? `Invitation sent to ${email}.`
                : `${email} already had an account; their access is updated. They can use "Forgot password?" to sign in.`);
            e.target.reset();
            await loadAdmins();
        } catch (error) {
            alertInline(error.message);
        } finally {
            button.disabled = false;
        }
    });

    await loadAdmins();
})();
