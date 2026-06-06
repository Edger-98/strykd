export const API = '/api'

export const getToken = () => localStorage.getItem('strykd_token')
export const setToken = t => localStorage.setItem('strykd_token', t)
export const clearToken = () => localStorage.removeItem('strykd_token')

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
})

async function req(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: authHeaders(),
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw Object.assign(new Error(err.detail || 'Request failed'), { status: res.status })
  }
  return res.json()
}

export const api = {
  register: body => req('POST', '/auth/register', body),
  login: body => req('POST', '/auth/login', body),

  dashboard: () => req('GET', '/dashboard'),
  journey: () => req('GET', '/journey'),
  publicPage: slug => fetch(`${API}/public/${slug}`).then(r => r.ok ? r.json() : Promise.reject(r)),

  completeTask: id => req('PATCH', `/tasks/${id}/complete`),
  addQuickTask: content => req('POST', '/tasks/quick', { content }),
  updateTask: (id, body) => req('PATCH', `/tasks/${id}`, body),
  deleteTask: id => req('DELETE', `/tasks/${id}`),
  reorderTasks: task_ids => req('POST', '/tasks/reorder', { task_ids }),

  onboard: body => req('POST', '/onboarding', body),

  // Account / settings
  getMe: () => req('GET', '/me'),
  updateMe: body => req('PATCH', '/me', body),
  changePassword: body => req('POST', '/me/password', body),
  deleteAccount: () => req('DELETE', '/me'),

  // Goal pause/resume + public visibility
  updateGoal: (id, body) => req('PATCH', `/goals/${id}`, body),

  // Password reset
  forgotPassword: email => req('POST', '/auth/forgot-password', { email }),
  validateResetToken: token => fetch(`${API}/auth/reset-password/${token}`).then(r => r.ok ? r.json() : Promise.reject(r)),
  resetPassword: (token, new_password) => req('POST', '/auth/reset-password', { token, new_password }),

  // Visitor encouragement (no auth)
  encourage: (slug, body) => fetch(`${API}/public/${slug}/encourage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async r => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }))
      throw Object.assign(new Error(err.detail || 'Request failed'), { status: r.status })
    }
    return r.json()
  }),

  // Creates a Stripe Checkout session (7-day trial); returns { checkout_url }
  checkout: () => req('POST', '/billing/checkout'),
  billingPortal: () => req('POST', '/billing/portal'),
  cancelSubscription: () => req('POST', '/billing/cancel'),

  replanConfirm: body => req('POST', '/replan/confirm', body),

  // Returns the raw Response for streaming
  replanStream: (change_request) =>
    fetch(`${API}/replan`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ change_request }),
    }),
}
