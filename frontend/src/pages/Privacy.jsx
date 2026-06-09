import LegalPage from '../components/LegalPage'

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="June 2026"
      intro="This Privacy Policy explains what information Strykd collects, how we use it, and the choices you have. By using Strykd you agree to the practices described here."
      sections={[
        { title: 'Information we collect', body: [
          'Account information: your name, email address, chosen page handle (slug), password (stored only as a secure hash), and an optional profile photo and bio.',
          'Goal and task content: the goals, plans, daily tasks, notes, streaks, signal wall entries, and any photos or videos you upload as proof.',
          'Collaboration content: shared lists you create and the tasks added to them, including by anonymous guests.',
          'Payment information: when you subscribe, billing is handled by Stripe. We do not store your card details. We keep a Stripe customer and subscription reference and your subscription status.',
          'Usage information: basic activity such as when you last opened your dashboard, your timezone, and standard server logs.',
        ]},
        { title: 'How we use your information', body: [
          'To build and run your personalized plan, generate your visual identity, and power your public page.',
          'To send transactional and reminder emails you have enabled (welcome, password reset, streak reminders, trial and subscription notices). You can turn reminder emails off in Settings.',
          'To process subscriptions, trials, and refunds.',
          'To keep the service secure, debug issues, and improve the product.',
        ]},
        { title: 'AI processing', body: [
          'Strykd uses Anthropic\'s Claude API to generate your plan, clarify your goal, review uploaded proof, and create shared-list itineraries. The relevant inputs you provide are sent to Anthropic to produce these results. We do not use your data to train models.',
        ]},
        { title: 'Service providers', body: [
          'We share data with the providers needed to run Strykd: Stripe (payments), Anthropic (AI), Resend (email), and Amazon Web Services (hosting and proof file storage). Each processes data only to provide their service.',
        ]},
        { title: 'Public pages and sharing', body: [
          'If your page is set to public, the information on it (your name, mission, goals, progress, streaks, daily tasks, and proof photos for goals you mark public) is visible to anyone with the link. You can make your page or individual goals private at any time in Settings or on the Journey page.',
          'Shared lists are public to anyone who has the link, by design. Do not put sensitive information in a shared list.',
        ]},
        { title: 'Cookies and local storage', body: [
          'We use your browser\'s local storage to keep you signed in and to remember lightweight preferences (such as a guest name for shared lists). We do not use third-party advertising trackers.',
        ]},
        { title: 'Data retention and deletion', body: [
          'We keep your data while your account is active. You can permanently delete your account at any time from Settings, which removes your goals, tasks, signal wall entries, billing references, and personal data.',
        ]},
        { title: 'Your choices', body: [
          'You can edit your profile, toggle email reminders, make your page private, cancel or request a refund of your subscription, and delete your account, all from Settings.',
        ]},
        { title: 'Children', body: [
          'Strykd is not directed to children under 13, and we do not knowingly collect their information.',
        ]},
        { title: 'Changes and contact', body: [
          'We may update this policy from time to time; material changes will be reflected by the date above. Questions about privacy? Email hello@strykdapp.com.',
        ]},
      ]}
    />
  )
}
