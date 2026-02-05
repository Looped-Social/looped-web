import { PageShell } from "~/components/PageShell/PageShell";

const verificationSteps = [
  {
    title: "Email verification",
    copy: "Use your company or school email. We send a verification link and you are approved quickly.",
  },
  {
    title: "Photo plus ID verification",
    copy: "Upload a photo of your face and a government ID. This path takes longer but works when email is not available.",
  },
  {
    title: "Yearly re-verification",
    copy: "We ask you to re-verify once a year to keep communities accurate and trustworthy.",
  },
];

const privacyGuarantees = [
  {
    title: "Two profiles, no link",
    copy: "You have an anonymous profile and a public-facing profile. There is no link between them.",
  },
  {
    title: "Cryptographic separation",
    copy: "We use cryptographic protocols so the profiles cannot be linked, even if all of our data were exposed.",
  },
  {
    title: "No hidden mapping",
    copy: "We do not store a link between profiles, which means we cannot connect them for anyone.",
  },
];

const backupSteps = [
  {
    title: "Open Anonymous Backup",
    copy: "Go to Settings and open Anonymous Backup.",
  },
  {
    title: "Create your passphrase",
    copy: "Create a passphrase and copy the backup code shown to you.",
  },
  {
    title: "Restore when needed",
    copy: "On another device, enter your passphrase and backup code to restore your anonymous profile.",
  },
];

export function PrivacyPage() {
  return (
    <PageShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-14">
        <header className="space-y-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Privacy</p>
          <h1 className="text-4xl font-semibold tracking-tight text-strong md:text-5xl">
            Privacy that protects your identity
          </h1>
          <p className="text-lg leading-8 text-text-secondary md:text-xl">
            Looped is a company- and school-verified social media app. You can view any post, but you must verify to
            join and post in a company or school community. Joining a company unlocks Fields, and joining a school
            unlocks Majors.
          </p>
        </header>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-strong">How verification works</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {verificationSteps.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-border bg-bg p-6 shadow-sm">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold text-strong">{step.title}</h3>
                <p className="mt-2 text-base leading-7 text-text-secondary">{step.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-strong">Anonymous and public profiles</h2>
          <p className="text-base leading-7 text-text-secondary">
            Looped gives you two identities: one anonymous, one public. If you are anonymous123 and sallyandbob,
            nobody can prove those are the same person. That separation is our guarantee.
          </p>
          <div className="grid gap-5 md:grid-cols-3">
            {privacyGuarantees.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-border bg-bg-muted p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)]"
              >
                <h3 className="text-lg font-semibold text-strong">{item.title}</h3>
                <p className="mt-2 text-base leading-7 text-text-secondary">{item.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-strong">Anonymous backup is required</h2>
          <p className="text-base leading-7 text-text-secondary">
            Because your anonymous profile is not linked to your public profile, you must back it up manually.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {backupSteps.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-border bg-bg p-6 shadow-sm">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold text-strong">{step.title}</h3>
                <p className="mt-2 text-base leading-7 text-text-secondary">{step.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-bg-muted px-6 py-8 ring-1 ring-border md:px-10">
          <h2 className="text-2xl font-semibold text-strong">If you lose your backup</h2>
          <p className="mt-3 text-base leading-7 text-text-secondary">
            If you are signed out and lose your passphrase or backup code, we cannot recover your anonymous profile.
            You will need to create a new anonymous profile.
          </p>
          <p className="mt-3 text-base leading-7 text-text-secondary">
            If you are still signed in, you can create a new passphrase and copy a new backup code. The new backup
            replaces the old one.
          </p>
        </section>
      </div>
    </PageShell>
  );
}
