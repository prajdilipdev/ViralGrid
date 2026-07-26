import { Link } from "react-router-dom";
import PublicPage, { Section, CONTACT_EMAIL, LAST_UPDATED } from "../components/PublicPage";

export default function DataDeletion() {
  const mailto =
    `mailto:${CONTACT_EMAIL}` +
    `?subject=${encodeURIComponent("ViralGrid data deletion request")}` +
    `&body=${encodeURIComponent(
      "Please delete my ViralGrid account and all data associated with it.\n\n" +
      "The email address I sign in with: \n",
    )}`;

  return (
    <PublicPage
      title="Deleting your data"
      updated={LAST_UPDATED}
      intro="There are two ways to remove data from ViralGrid: clear individual items yourself from inside the app, or ask for the whole account to be erased. Neither costs anything and no reason is needed."
    >
      <Section title="A note on who uses this app">
        <p>
          ViralGrid is a private tool used only by its owner, and sign-in is limited to a fixed list of
          approved addresses — there is no public sign-up. In practice the only account that exists is the
          owner's. These instructions are published so the process is on record and can be followed by
          anyone who ever does hold an account.
        </p>
      </Section>

      <Section title="Removing individual things yourself">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <span className="text-white/80">A post</span> — open <span className="text-white/80">History</span>,
            find the post and use the delete button on its row. This removes the post, its caption and its
            recorded figures.
          </li>
          <li>
            <span className="text-white/80">The Instagram connection</span> — open{" "}
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
          from the address used to sign in, asking for the account to be deleted. Sending it from that
          address is what confirms the request is genuine.
        </p>
        <p>
          It will be actioned within 30 days — usually far sooner — and confirmed by reply.
        </p>
        <div className="border border-white/10 rounded-md p-4 mt-4 bg-white/[0.02]">
          <p className="text-xs text-white/50 mb-2">Everything below is removed:</p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-white/60">
            <li>The account record — name, email address and profile picture URL</li>
            <li>Every post, including titles, captions, descriptions, hashtags and tags</li>
            <li>Every video and image uploaded, and any converted versions of them</li>
            <li>The Instagram access token, account ID and username</li>
            <li>All platform connections, scheduled posts and recorded statistics</li>
            <li>All sign-in sessions</li>
          </ul>
        </div>
      </Section>

      <Section title="What deletion does not cover">
        <p>
          Posts already published to Instagram stay on Instagram. ViralGrid only removes its own copy of
          the record — it cannot reach into an Instagram account and take posts down. To remove a
          published reel, delete it in the Instagram app as normal.
        </p>
        <p>
          Once data is deleted here it cannot be recovered, so save anything worth keeping beforehand.
        </p>
      </Section>

      <Section title="Revoking access from Instagram's side">
        <p>
          Access can be cut off immediately from Instagram itself: open{" "}
          <span className="text-white/80">Settings → Apps and websites</span>, find ViralGrid and remove
          it. That invalidates the token at once, though it does not delete what is already stored here —
          email the address above for that.
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
    </PublicPage>
  );
}
