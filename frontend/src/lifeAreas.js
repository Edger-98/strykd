// Life-area categories with cinematic Unsplash imagery + recommended starter goals.
// Shared by the onboarding picker and the Journey cards.

export const LIFE_AREAS = [
  { id: 'career', label: 'Career', img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80' },
  { id: 'fitness', label: 'Fitness', img: 'https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=1200&q=80' },
  { id: 'business', label: 'Business', img: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=1200&q=80' },
  { id: 'creative', label: 'Creative', img: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&q=80' },
  { id: 'personal-growth', label: 'Personal Growth', img: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&q=80' },
  { id: 'sobriety', label: 'Sobriety', img: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&q=80' },
  { id: 'relationships', label: 'Relationships', img: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&q=80' },
  { id: 'finance', label: 'Finance', img: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&q=80' },
  { id: 'education', label: 'Education', img: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=1200&q=80' },
  { id: 'travel', label: 'Travel', img: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80' },
  { id: 'mindfulness', label: 'Mindfulness', img: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&q=80' },
  { id: 'side-project', label: 'Side Project', img: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&q=80' },
]

export const LIFE_AREA_IMG = Object.fromEntries(LIFE_AREAS.map(a => [a.id, a.img]))

export function imgForArea(la) {
  const key = (la || '').replace('_', '-')
  return LIFE_AREA_IMG[key] || LIFE_AREA_IMG.career
}

export const RECOMMENDED_GOALS = {
  career: ['Land a software engineering job', 'Get promoted to senior', 'Build a portfolio that gets callbacks'],
  fitness: ['Get visible abs in 30 days', 'Run my first 5K', 'Build a consistent gym habit'],
  business: ['Launch my MVP and get first 10 users', 'Hit $1K MRR', 'Build and ship a product in 30 days'],
  creative: ['Finish and publish my first short story', 'Post original art every day for 30 days', 'Write and release a song'],
  'personal-growth': ['Read 6 books in 90 days', 'Build a daily morning routine', 'Journal every day for 30 days'],
  sobriety: ['Stay sober for 90 days', 'Build sober routines that stick', 'Get through 30 days, one day at a time'],
  relationships: ['Be fully present with my family daily', 'Go on one real date every week', 'Reconnect with three old friends'],
  finance: ['Save my first $5,000', 'Pay off my credit card debt', 'Build a monthly budget I stick to'],
  education: ['Learn Python and build a project', 'Pass my certification exam', 'Study a new language for 30 days'],
  travel: ['Plan and book my dream trip', 'Save for a 3-month sabbatical', 'Learn the basics before I go'],
  mindfulness: ['Meditate every day for 30 days', 'Build a calmer daily routine', 'Cut my screen time in half'],
  'side-project': ['Ship my side project in 30 days', 'Get my first 100 users', 'Build it on nights and weekends'],
}
