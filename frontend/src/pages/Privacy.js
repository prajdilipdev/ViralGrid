import { Link } from "react-router-dom";
import Logo from "../components/Logo";

// Update this if you want people to reach you at a different address.
const CONTACT_EMAIL = "prajjdilip@gmail.com";
const LAST_UPDATED = "26 July 2026";

const Section = ({ title, children }) => (
  <section className="mt-10">
    <h2 className="text-lg font-semibold tracking-tight mb-3">{title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-white/70">{children}</div>
  </section>
);

const Row = ({ what, why }) => (
  <tr className="border-t border-white/5 align-top">
    <td className="py-2.5 pr-6 text-white/80 whitespace-nowrap">{what}</td>
    <td className="py-2.5 text-white/60">{why}</td>
  </tr>
);

export default function Privacy() {
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
        <h1 className="text-3xl sm:text-4xl tracking-tighter font-light">Privacy Policy</h1>
        <p className="text-xs text-white/40 mt-3">Last updated {LAST_UPDATED}</p>

        <p className="mt-8 text-sm leading-relaxed text-white/70">
          ViralGrid is a personal tool for scheduling and publishing short-form video to social media.
          It is run by one person, not a company, and it is not open to the public — only email
          addresses on an approved list can sign in. This page explains what the app stores, where it
          goes, and how to get rid of it.
        </p>

        <Section title="What the app stores">
          <p>
            When you sign in with Google, ViralGrid receives and stores your name, email address and
            profile picture URL. It never sees or stores your Google password.
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
                <Row what="Name, email, profile picture" why="To identify your account and show who is signed in." />
                <Row what="Session token" why="Keeps you logged in. Stored in your browser and in the database, and expires if unused." />
                <Row what="Videos and images you upload" why="Needed to publish. Also converted with ffmpeg into platform-specific versions (for example 1080×1920 for Reels)." />
                <Row what="Post content" why="Titles, captions, descriptions, hashtags, tags, chosen platforms, scheduled times and time zone." />
                <Row what="Instagram access token" why="Lets the app post on your behalf. Stored server-side only and never sent to your browser." />
                <Row what="Your Instagram username and account ID" why="To show which account is connected and to publish to it." />
                <Row what="Post performance figures" why="Views, likes, comments and shares fetched from Instagram for posts you published." />
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Instagram data">
          <p>
            If you connect Instagram, the app asks only for the permissions it needs to read your basic
            profile and publish content. The access token it receives is kept on the server, is
            refreshed automatically before it expires, and is deleted the moment you disconnect the
            account on the Connections page.
          </p>
          <p>
            One technical detail worth stating plainly: Instagram does not accept a direct file upload.
            It downloads your video from a public link on this app's server. That means a video you are
            publishing is briefly reachable by anyone who has the exact link, which is a random,
            unguessable filename. Nothing else about your account is exposed this way.
          </p>
          <p>
            Data obtained from Instagram is used only to display your own posts and their figures back
            to you inside the app. It is not combined with other sources, sold, or shared.
          </p>
        </Section>

        <Section title="Where it is kept">
          <p>
            Everything lives in a MongoDB Atlas database and on the application server, which is hosted
            on Render. Uploaded video is held on the server's disk and copied into the database so it
            survives restarts.
          </p>
          <p>
            These service providers can technically access the infrastructure the data sits on, as any
            host can. They are not given the data for their own purposes.
          </p>
        </Section>

        <Section title="What the app does not do">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>No advertising, and no data sold or rented to anyone.</li>
            <li>No analytics, tracking pixels, session recording or third-party cookies. The only cookie is the one that keeps you signed in.</li>
            <li>No reading of your Instagram direct messages, follower lists, or anyone else's content.</li>
            <li>No email marketing. The app will not message you.</li>
          </ul>
        </Section>

        <Section title="Other services involved">
          <ul className="list-disc pl-5 space-y-1.5">
            <li><span className="text-white/80">Google</span> — sign-in. Handled through a hosted authentication service, so the sign-in step happens on a page operated by that provider rather than on this site.</li>
            <li><span className="text-white/80">Meta / Instagram</span> — publishing and post statistics, only for an account you connect yourself.</li>
            <li><span className="text-white/80">MongoDB Atlas</span> — the database.</li>
            <li><span className="text-white/80">Render</span> — hosting for the site and the server.</li>
          </ul>
        </Section>

        <Section title="Deleting your data">
          <p>
            You can delete any individual post from the History page, and disconnect Instagram at any
            time from the Connections page, which removes the stored access token immediately.
          </p>
          <p>
            To have everything removed — account, uploaded media, posts and connections — email{" "}
            <a href={`mailto:${CONTACT_EMAIL}?subject=ViralGrid%20data%20deletion%20request`}
               className="text-white underline underline-offset-2 hover:text-white/80">
              {CONTACT_EMAIL}
            </a>{" "}
            from the address you signed in with, asking for deletion. It will be done within 30 days and
            you will get a reply confirming it. There is no charge and you do not need to give a reason.
          </p>
          <p>
            You can also revoke this app's access to your Instagram account directly from Instagram,
            under Settings → Apps and websites.
          </p>
        </Section>

        <Section title="How long things are kept">
          <p>
            Posts and their figures are kept until you delete them or ask for your account to be
            removed. Sign-in sessions expire after a year of not being used. Uploaded video that is no
            longer attached to a post is removed when the server's storage is cleared.
          </p>
        </Section>

        <Section title="Security">
          <p>
            Traffic to the site and the server is encrypted over HTTPS. Instagram access tokens are held
            server-side and are never included in anything sent to your browser. Sign-in is limited to an
            approved list of email addresses, so an account cannot be created without being added first.
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
            how your data is handled will be mentioned in the app itself, not quietly edited in.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions, requests or complaints:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-white underline underline-offset-2 hover:text-white/80">
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>

        <div className="mt-14 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-white/40">
          <span>ViralGrid</span>
          <Link to="/login" className="hover:text-white transition-colors duration-200">Back to sign in</Link>
        </div>
      </main>
    </div>
  );
}
