// Public Privacy Policy and Terms (no login). Plain-English drafts: have a lawyer review before selling.
const UPDATED = '8 November 2026'

const PRIVACY = [
  ['Who we are', 'Site Log is a project and photo tracking app for builders and renovators. This policy explains what we collect and why. Contact: use the Feedback button in the app, or the support email given where you signed up.'],
  ['What we collect', 'Your email and password (the password is stored scrambled, never readable). The content your company adds: projects, tasks, notes, diary entries, photos (which may include the location they were taken), expenses and quotes. Basic use information needed to run the service.'],
  ['Whose data it is', 'Each company\'s data belongs to that company. People in one company cannot see another company\'s data. Clients you share a progress link with see only the schedule and the photos you choose, never costs or notes.'],
  ['Who can see it', 'Managers and crew in your company, according to their role (crew do not see money). The app owner can look inside a company only in a read-only support session, which needs a stated reason and is logged. We do not sell your data or show advertising.'],
  ['Where it is kept', 'Data is stored with our hosting provider, Supabase, in Tokyo, Japan. By using the app you accept your data being stored outside Australia.'],
  ['Your choices', 'Managers can remove people. A company can ask us to export or permanently delete its data at any time by sending feedback or contacting us. Deleting removes photos and records, and cannot be undone.'],
  ['Security', 'Access is by login, every company is kept separate by the database itself, and photo files are private. No system is perfect, so keep your password safe and tell us about anything suspicious.'],
  ['Changes', 'If this policy changes we will update the date above.']
]

const TERMS = [
  ['Using the app', 'Site Log is provided to help you manage building jobs. Keep your login private and only invite people who should have access.'],
  ['Your content', 'You own what you put in. You promise you have the right to upload it (including photos of client homes). You give us permission to store and show it to the people you choose, and to look inside only for support as described in the Privacy Policy.'],
  ['Acceptable use', 'No illegal content, no attempts to get into other companies\' data, no abusing or overloading the service.'],
  ['Availability and backups', 'We work to keep the app running but do not promise it will always be available or error-free. Keep your own copy of important records (use the export feature).'],
  ['Limits', 'The app is a tool, not professional advice. Quotes, schedules and compliance checklists are your responsibility. To the extent the law allows, we are not liable for lost profits or indirect loss.'],
  ['Payment', 'Any trial or paid plan will be agreed with you before you are charged.'],
  ['Ending', 'You can stop using the app at any time. We may suspend a company that breaks these terms. Governing law: Victoria, Australia.']
]

export default function LegalPage({ kind }) {
  const isPrivacy = kind === 'privacy'
  const sections = isPrivacy ? PRIVACY : TERMS
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="text-2xl font-semibold text-ink-900">{isPrivacy ? 'Privacy Policy' : 'Terms of Service'}</h1>
      <p className="mt-1 text-xs text-ink-400">Site Log · updated {UPDATED}</p>
      {sections.map(([h, t]) => (
        <section key={h} className="mt-5">
          <h2 className="text-base font-semibold text-ink-900">{h}</h2>
          <p className="mt-1 text-sm leading-6 text-ink-600">{t}</p>
        </section>
      ))}
      <p className="mt-8 text-sm">
        <a className="font-medium text-signal-600 underline underline-offset-2" href={isPrivacy ? '/#terms' : '/#privacy'}>
          {isPrivacy ? 'Terms of Service' : 'Privacy Policy'}
        </a>
      </p>
    </div>
  )
}
