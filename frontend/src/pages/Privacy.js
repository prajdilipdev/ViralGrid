import { Link } from "react-router-dom";
import PublicPage, { Section, CONTACT_EMAIL, LAST_UPDATED } from "../components/PublicPage";

const Row = ({ what, why }) => (
  <tr className="border-t border-white/5 align-top">
    <td className="py-2.5 px-4 text-white/80 whitespace-nowrap">{what}</td>
    <td className="py-2.5 px-4 text-white/60">{why}</td>
  </tr>
);

export default function Privacy() {
  return (
    <PublicPage
      title="Privacy Policy"
      updated={LAST_UPDATED}
      intro="ViralGrid is a private tool for scheduling and publishing short-form video, used only by its owner. It is run by one person, not a company. This page explains what it stores, where that goes, and how to get rid of it."
    >
      <Section title="Who uses this app">
        <p>
          This app is used only by me, its owner, for my own accounts. It is not published as a public
          service and is not offered to anyone else.
        </p>
        <p>
          Sign-in is restricted to a fixed list of approved email addresses held on the server. There is
          no registration page and no way to request access — an account cannot be created unless the
          address is added to that list first. In practice that means the only personal data in the system
          is my own.
        </p>
        <p>
          This policy is published anyway because the app connects to Instagram through Meta's API, and
          because anyone who lands on the site deserves to know what it would do with their data if they
          ever did have an account.
        </p>
      </Section>

      <Section title="What the app stores">
        <p>
          Signing in with Google gives the app your name, email address and profile picture URL. It never
          sees or stores your Google password.
        </p>
        <div className="overflow-x-auto border border-white/10 rounded-md mt-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/40 uppercase tracking-widest text-[10px]">
                <th className="text-left px-4 py-3 font-semibold">Data</th>
                <th className="text-left px-4 py-3 font-semibold">Why it exists</th>
              </tr>
            </thead>
            <tbody>
              <Row what="Name, email, profile picture" why="To identify the account and show who is signed in." />
              <Row what="Session token" why="Keeps you logged in. Held in your browser and in the database, and expires if unused." />
              <Row what="Videos and images uploaded" why="Needed to publish. Also converted with ffmpeg into platform-specific versions, such as 1080×1920 for Reels." />
              <Row what="Post content" why="Titles, captions, descriptions, hashtags, tags, chosen platforms, scheduled times and time zone." />
              <Row what="Instagram access token" why="Lets the app post on your behalf. Held server-side only and never sent to the browser." />
              <Row what="Instagram username and account ID" why="To show which account is connected and to publish to it." />
              <Row what="Post performance figures" why="Views, likes, comments and shares fetched from Instagram for posts published through the app." />
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Instagram data">
        <p>
          The app requests only the permissions it needs to read basic profile details and publish
          content. The access token is kept on the server, refreshed automatically before it expires, and
          deleted the moment the account is disconnected on the Connections page.
        </p>
        <p>
          One technical detail worth stating plainly: Instagram does not accept a direct file upload. It
          downloads the video from a public link on this app's server. A video being published is
          therefore briefly reachable by anyone holding that exact link, which is a random, unguessable
          filename. Nothing else about the account is exposed this way.
        </p>
        <p>
          Data obtained from Instagram is used only to display posts and their figures back inside the
          app. It is not combined with other sources, sold, or shared.
        </p>
      </Section>

      <Section title="Where it is kept">
        <p>
          Everything lives in a MongoDB Atlas database and on the application server, hosted on Render.
          Uploaded video sits on the server's disk and is copied into the database so it survives restarts.
        </p>
        <p>
          These providers can technically access the infrastructure the data sits on, as any host can.
          They are not given the data for their own purposes.
        </p>
      </Section>

      <Section title="What the app does not do">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>No advertising, and no data sold or rented to anyone.</li>
          <li>No analytics, tracking pixels, session recording or third-party cookies. The only cookie is the one that keeps you signed in.</li>
          <li>No reading of Instagram direct messages, follower lists, or anyone else's content.</li>
          <li>No email marketing. The app will not message you.</li>
        </ul>
      </Section>

      <Section title="Other services involved">
        <ul className="list-disc pl-5 space-y-1.5">
          <li><span className="text-white/80">Google</span> — sign-in, handled through a hosted authentication service, so that step happens on a page operated by that provider rather than on this site.</li>
          <li><span className="text-white/80">Meta / Instagram</span> — publishing and post statistics, only for an account connected deliberately.</li>
          <li><span className="text-white/80">MongoDB Atlas</span> — the database.</li>
          <li><span className="text-white/80">Render</span> — hosting for the site and the server.</li>
        </ul>
      </Section>

      <Section title="Deleting your data">
        <p>
          Any individual post can be deleted from the History page, and Instagram can be disconnected at
          any time from the Connections page, which removes the stored access token immediately.
        </p>
        <p>
          To have everything removed — account, uploaded media, posts and connections — email{" "}
          <a href={`mailto:${CONTACT_EMAIL}?subject=ViralGrid%20data%20deletion%20request`}
             className="text-white underline underline-offset-2 hover:text-white/80">
            {CONTACT_EMAIL}
          </a>{" "}
          from the address used to sign in. It will be done within 30 days and confirmed by reply. There
          is no charge and no reason is needed.
        </p>
        <p>
          Access can also be revoked directly from Instagram, under Settings → Apps and websites.
          Step-by-step instructions and the full list of what gets removed are on the{" "}
          <Link to="/data-deletion" className="text-white underline underline-offset-2 hover:text-white/80">
            data deletion page
          </Link>.
        </p>
      </Section>

      <Section title="How long things are kept">
        <p>
          Posts and their figures are kept until deleted or until the account is removed. Sign-in sessions
          expire after a year of not being used. Uploaded video no longer attached to a post is removed
          when the server's storage is cleared.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Traffic to the site and the server is encrypted over HTTPS. Instagram access tokens are held
          server-side and are never included in anything sent to the browser. Sign-in is limited to the
          approved list described above, so an account cannot be created without being added first.
        </p>
        <p>
          That said, this is a small personal project rather than an audited commercial service, and it
          would be wrong to imply otherwise. Please do not store anything here you could not stand to lose.
        </p>
      </Section>

      <Section title="Children">
        <p>ViralGrid is not intended for anyone under 13, and is not directed at children.</p>
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes, the date at the top changes with it. Anything that materially affects
          how data is handled will be mentioned in the app itself, not quietly edited in.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions, requests or complaints:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-white underline underline-offset-2 hover:text-white/80">
            {CONTACT_EMAIL}
          </a>{" "}
          — see the{" "}
          <Link to="/contact" className="text-white underline underline-offset-2 hover:text-white/80">contact page</Link>.
        </p>
      </Section>
    </PublicPage>
  );
}
