import { PageShell } from "@/marketing/components/PageShell/PageShell";

const verificationSteps = [
  {
    title: "Email verification",
    copy: "Use your company email. We send a verification link and you are approved quickly.",
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
      <div className="mx-auto flex max-w-5xl flex-col gap-12 px-2 md:gap-14">
        <header className="mx-auto flex w-full max-w-6xl flex-col items-center space-y-4 text-center">
          <h1 className="max-w-[16ch] text-[3rem] font-semibold leading-[0.95] tracking-[-0.05em] text-strong sm:text-[4rem] md:max-w-[18ch] md:text-[4.6rem]">
            Privacy that protects your identity
          </h1>
          <p className="max-w-[62ch] text-lg leading-8 text-text-secondary md:text-xl">
            Looped is a verified social platform for workplace and field communities with a full iOS app and a
            limited web experience. You can view posts on the web, but you verify in the iOS app to join and post in
            your workplace community. Joining your workplace unlocks field communities.
          </p>
        </header>

        <section className="mx-auto w-full max-w-4xl">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-strong md:text-4xl">How verification works</h2>
            <p className="mt-4 text-base leading-8 text-text-secondary">
              Verification currently happens in the iOS app. We are working on secure web verification support.
            </p>
          </div>
          <div className="mt-8 grid gap-4">
            {verificationSteps.map((step) => (
              <div
                key={step.title}
                className="rounded-[1.75rem] border border-border bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.035)]"
              >
                <h3 className="text-xl font-semibold text-strong">{step.title}</h3>
                <p className="mt-3 text-base leading-7 text-text-secondary">{step.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-strong md:text-4xl">
              Anonymous and public profiles
            </h2>
            <p className="mt-4 text-base leading-8 text-text-secondary">
              Looped gives you two identities: one anonymous, one public. If you are anonymous123 and sallyandbob,
              nobody can prove those are the same person. That separation is our guarantee.
            </p>
          </div>
          <div className="mt-8 grid gap-4">
            {privacyGuarantees.map((item) => (
              <div
                key={item.title}
                className="rounded-[1.75rem] border border-border bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.035)]"
              >
                <h3 className="text-xl font-semibold text-strong">{item.title}</h3>
                <p className="mt-3 text-base leading-7 text-text-secondary">{item.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-strong md:text-4xl">
              Anonymous backup is required
            </h2>
            <p className="mt-4 text-base leading-8 text-text-secondary">
              Because your anonymous profile is not linked to your public profile, you must back it up manually.
            </p>
          </div>

          <div className="mt-8 grid gap-4">
            {backupSteps.map((step) => (
              <div
                key={step.title}
                className="rounded-[1.75rem] border border-border bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.035)]"
              >
                <h3 className="text-xl font-semibold text-strong">{step.title}</h3>
                <p className="mt-3 text-base leading-7 text-text-secondary">{step.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl rounded-[2rem] bg-bg-muted/55 p-7 lg:p-8">
          <h2 className="text-3xl font-semibold tracking-tight text-strong md:text-4xl">If you lose your backup</h2>
          <p className="mt-4 max-w-4xl text-base leading-8 text-text-secondary">
            If you are signed out and lose your passphrase or backup code, we cannot recover your anonymous profile.
            You will need to create a new anonymous profile.
          </p>
          <p className="mt-4 max-w-4xl text-base leading-8 text-text-secondary">
            If you are still signed in, you can create a new passphrase and copy a new backup code. The new backup
            replaces the old one.
          </p>
        </section>
      </div>
    </PageShell>
  );
}
