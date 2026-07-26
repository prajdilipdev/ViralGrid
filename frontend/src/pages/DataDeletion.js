import { Link } from "react-router-dom";
import Logo from "../components/Logo";

// Keep in step with the address in Privacy.js.
const CONTACT_EMAIL = "prajjdilip@gmail.com";
const LAST_UPDATED = "26 July 2026";

const Section = ({ title, children }) => (
  <section className="mt-10">
    <h2 className="text-lg font-semibold tracking-tight mb-3">{title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-white/70">{children}</div>
  </section>
);

export default function DataDeletion() {
  const mailto =
    `mailto:${CONTACT_EMAIL}` +
    `?subject=${encodeURIComponent("ViralGrid data deletion request")}` +
    `&body=${encodeURIComponent(
      "Please delete my ViralGrid account and all data associated with it.\n\n" +
      "The email address I sign in with: \n",
    )}`;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-2.5">
          <Logo size={20} className="text-white" />
          <span className="tracking-tight font-semibold">ViralGrid</span>
          <Link to="/login" className="ml-auto text-xs text-white/50 hover:text-white transition-colors duration-200">
            Sign in
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 pb-24">
        <h1 className="text-3xl sm:text-4xl tracking-tighter font-light">Deleting your data</h1>
        <p className="text-xs text-white/40 mt-3">Last updated {LAST_UPDATED}</p>

        <p className="mt-8 text-sm leading-relaxed text-white/70">
          There are two ways to remove data from ViralGrid: clear individual items yourself from inside
          the app, or ask for the whole account to be erased. Both are described below. Neither costs
          anything and you do not have to give a reason.
        </p>

        <Section title="Removing individual things yourself">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <span className="text-white/80">A post</span> — open <span className="text-white/80">History</span>,
              find the post and use the delete button on its row. This removes the post, its caption and
              its recorded figures.
            </li>
            <li>
              <span className="text-white/80">Your Instagram connection</span> — open{" "}
              <span className="text-white/80">Connections</span> and press Disconnect. The stored access
              token is deleted straight away and the app can no longer post or read anything from that
              account.
            </li>
          </ul>
        </Section>

        <Section title="Deleting the whole account">
          <p>
            Email{" "}
            <a href={mailto} className="text-white underline underline-offset-2 hover:text-white/80">
              {CONTACT_EMAIL}
            </a>{" "}
            from the address you sign in with, and ask for your account to be deleted. Sending it from
            that address is what confirms the request is really yours.
          </p>
          <p>
            It will be actioned within 30 days — usually far sooner — and you will get a reply confirming
            the deletion is done.
          </p>
          <div className="border border-white/10 rounded-md p-4 mt-4 bg-white/[0.02]">
            <p className="text-xs text-white/50 mb-2">Everything below is removed:</p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-white/60">
              <li>Your account record — name, email address and profile picture URL</li>
              <li>Every post, including titles, captions, descriptions, hashtags and tags</li>
              <li>Every video and image you uploaded, and any converted versions of them</li>
              <li>Your Instagram access token, account ID and username</li>
              <li>All platform connections, scheduled posts and recorded statistics</li>
              <li>All sign-in sessions</li>
            </ul>
          </div>
        </Section>

        <Section title="What deletion does not cover">
          <p>
            Posts that were already published to Instagram stay on Instagram. ViralGrid only removes its
            own copy of the record — it cannot reach into your Instagram account and take posts down. To
            remove a published reel, delete it in the Instagram app as you normally would.
          </p>
          <p>
            Once your data is deleted here it cannot be recovered, so export or save anything you want to
            keep beforehand.
          </p>
        </Section>

        <Section title="Revoking access from Instagram's side">
          <p>
            You can cut off this app's access without waiting for anything, directly in Instagram: open{" "}
            <span className="text-white/80">Settings → Apps and websites</span>, find ViralGrid and remove
            it. That immediately invalidates the token, though it does not delete what is already stored
            here — email the address above for that.
          </p>
        </Section>

        <Section title="Questions">
          <p>
            Anything unclear, or no reply within 30 days:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-white underline underline-offset-2 hover:text-white/80">
              {CONTACT_EMAIL}
            </a>
            . Full detail on what is stored and why is in the{" "}
            <Link to="/privacy" className="text-white underline underline-offset-2 hover:text-white/80">
              Privacy Policy
            </Link>
            .
          </p>
        </Section>

        <div className="mt-14 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-white/40">
          <Link to="/privacy" className="hover:text-white transition-colors duration-200">Privacy Policy</Link>
          <Link to="/login" className="hover:text-white transition-colors duration-200">Back to sign in</Link>
        </div>
      </main>
    </div>
  );
}
