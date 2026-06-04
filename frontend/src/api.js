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
  publicPage: slug => fetch(`${API}/public/${slug}`).then(r => r.ok ? r.json() : Promise.reject(r)),

  completeTask: id => req('PATCH', `/tasks/${id}/complete`),

  onboard: body => req('POST', '/onboarding', body),

  // Creates a Stripe Checkout session (7-day trial); returns { checkout_url }
  checkout: () => req('POST', '/billing/checkout'),

  replanConfirm: body => req('POST', '/replan/confirm', body),

  // Returns the raw Response for streaming
  replanStream: (change_request) =>
    fetch(`${API}/replan`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ change_request }),
    }),
}
