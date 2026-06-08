export const API = '/api'

export const getToken = () => localStorage.getItem('strykd_token')
export const setToken = t => localStorage.setItem('strykd_token', t)
export const clearToken = () => localStorage.removeItem('strykd_token')

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
})

// Silent refresh: if the backend handed back a fresh token, swap it in.
function absorbRefresh(res) {
  const t = res.headers.get('X-New-Token')
  if (t) setToken(t)
}

async function req(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: authHeaders(),
    body: body != null ? JSON.stringify(body) : undefined,
  })
  absorbRefresh(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw Object.assign(new Error(err.detail || 'Request failed'), { status: res.status })
  }
  return res.json()
}

// Multipart upload: let the browser set the multipart boundary; only attach auth.
async function upload(path, file) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  })
  absorbRefresh(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw Object.assign(new Error(err.detail || 'Upload failed'), { status: res.status })
  }
  return res.json()
}

// No-auth JSON request (public collaborative endpoints)
async function publicJson(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
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

  // Visual proof uploads
  uploadTaskProof: (taskId, file) => upload(`/tasks/${taskId}/proof`, file),
  uploadDailyProof: (goalId, file) => upload(`/goals/${goalId}/daily-proof`, file),

  // Premium todo mode
  getTodos: () => req('GET', '/todos'),
  createTodo: body => req('POST', '/todos', body),
  updateTodo: (id, body) => req('PATCH', `/todos/${id}`, body),
  deleteTodo: id => req('DELETE', `/todos/${id}`),

  // Shared collaborative lists (owner = auth, guests = public)
  createSharedList: body => req('POST', '/shared-lists', body),
  getSharedLists: () => req('GET', '/shared-lists'),
  deleteSharedList: code => req('DELETE', `/shared-lists/${code}`),
  generateItinerary: code => req('POST', `/shared-lists/${code}/itinerary`),
  getSharedList: code => fetch(`${API}/shared/${code}`).then(r => r.ok ? r.json() : Promise.reject(r)),
  addSharedTask: (code, body) => publicJson('POST', `/shared/${code}/tasks`, body),
  toggleSharedTask: (code, id, body) => publicJson('PATCH', `/shared/${code}/tasks/${id}`, body),

  onboard: body => req('POST', '/onboarding', body),

  // Goal clarification chat: returns {type:'question'|'refined', message, refined_goal?}
  clarify: (conversation, life_area) => req('POST', '/onboarding/clarify', { conversation, life_area }),

  // Returns the raw Response for SSE streaming of the plan generation stages
  onboardStream: form => {
    const qs = new URLSearchParams({
      goals: form.goals,
      duration_days: form.duration_days,
      aesthetic: form.aesthetic,
      life_area: form.life_area,
      why_now: form.why_now,
      past_blockers: form.past_blockers,
      hours_per_day: form.hours_per_day,
      daily_rhythm: form.daily_rhythm,
      page_public: form.page_public,
    }).toString()
    return fetch(`${API}/onboarding/stream?${qs}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
  },

  // Account / settings
  getMe: () => req('GET', '/me'),
  updateMe: body => req('PATCH', '/me', body),
  changePassword: body => req('POST', '/me/password', body),
  deleteAccount: () => req('DELETE', '/me'),

  // Goal pause/resume + public visibility
  updateGoal: (id, body) => req('PATCH', `/goals/${id}`, body),
  deleteGoal: id => req('DELETE', `/goals/${id}`),

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
  requestRefund: () => req('POST', '/billing/refund'),

  replanConfirm: body => req('POST', '/replan/confirm', body),

  // Returns the raw Response for streaming
  replanStream: (change_request) =>
    fetch(`${API}/replan`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ change_request }),
    }),
}
