import { Link } from "react-router-dom";
import PublicPage, { Section, CONTACT_EMAIL } from "../components/PublicPage";

export default function About() {
  return (
    <PublicPage
      title="About ViralGrid"
      intro="ViralGrid is a tool for scheduling and publishing short-form video. I built it for my own accounts because uploading the same reel to several platforms by hand, resizing it correctly each time, was taking longer than making the video."
    >
      <Section title="Who runs it">
        <p>
          One person. It is a personal project, not a company, not a startup and not a product for sale.
          There is no team, no office and no support desk behind it.
        </p>
      </Section>

      <Section title="It is private, and stays private">
        <p>
          This app is used only by me, its owner. It is not published as a public service and it is not
          offered to anyone else.
        </p>
        <p>
          Sign-in is limited to a fixed list of approved email addresses held on the server. There is no
          registration page, no invite system and no way to request access — an account cannot be created
          unless the address is added to that list first. Anyone else who reaches the site can read these
          pages and nothing more.
        </p>
        <p>
          The site is reachable on the public internet only because it has to be: Instagram needs a public
          address to fetch a video from when publishing. Being reachable is not the same as being open.
        </p>
      </Section>

      <Section title="What it actually does">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Takes one upload and converts it with ffmpeg to each platform's expected size and bitrate — 1080×1920 for Reels, for example — instead of exporting several versions by hand.</li>
          <li>Checks a video against a platform's limits before publishing, so a clip that is too long or the wrong shape is caught early rather than rejected on upload.</li>
          <li>Holds captions, hashtags and scheduled times in one place, with a calendar and a bulk scheduler for planning a batch of posts.</li>
          <li>Publishes to Instagram through Meta's official Content Publishing API, and records how each post performed.</li>
        </ul>
      </Section>

      <Section title="What it does not do yet">
        <p>
          Instagram is the only platform wired up to a real API. YouTube Shorts, TikTok, Facebook, X,
          Pinterest and LinkedIn appear in the interface, but publishing to them is simulated — the app
          records the post and generates placeholder figures rather than sending anything anywhere. They
          are there because the plumbing is in place for whenever those integrations get built, and the
          app labels them as simulated so the distinction is never in doubt.
        </p>
      </Section>

      <Section title="How it is built">
        <p>
          A Python and FastAPI backend with MongoDB, a React front end, and ffmpeg doing the video work.
          It runs on ordinary shared hosting, which is worth saying plainly: the server sleeps when it is
          not being used, so the first page load after a quiet spell takes a moment while it wakes up.
        </p>
      </Section>

      <Section title="Elsewhere">
        <p>
          What data it stores and why is set out in the{" "}
          <Link to="/privacy" className="text-white underline underline-offset-2 hover:text-white/80">Privacy Policy</Link>,
          and how to get that data removed is on the{" "}
          <Link to="/data-deletion" className="text-white underline underline-offset-2 hover:text-white/80">data deletion page</Link>.
          For anything else,{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-white underline underline-offset-2 hover:text-white/80">{CONTACT_EMAIL}</a>.
        </p>
      </Section>
    </PublicPage>
  );
}
