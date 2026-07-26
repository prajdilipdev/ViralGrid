import { Link } from "react-router-dom";
import PublicPage, { Section, CONTACT_EMAIL } from "../components/PublicPage";

const Item = ({ label, children }) => (
  <div className="border-t border-white/5 py-3">
    <p className="text-xs uppercase tracking-widest text-white/40 mb-1.5">{label}</p>
    <p className="text-sm text-white/70 leading-relaxed">{children}</p>
  </div>
);

export default function Contact() {
  return (
    <PublicPage
      title="Contact"
      intro="Email is the only way to reach me about this app, and it goes to a real inbox rather than a ticketing system."
    >
      <div className="mt-8 border border-white/10 rounded-md p-6 bg-white/[0.02]">
        <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Email</p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-lg text-white underline underline-offset-4 hover:text-white/80 transition-colors duration-200 break-all"
        >
          {CONTACT_EMAIL}
        </a>
      </div>

      <Section title="What to expect">
        <div className="mt-1">
          <Item label="Who replies">
            Me. ViralGrid is run by one person, so there is nobody else to escalate to.
          </Item>
          <Item label="How quickly">
            Usually within a few days. Deletion requests are handled within 30 days at the outside, and
            you will get a reply confirming when it is done.
          </Item>
          <Item label="What I cannot help with">
            Anything to do with your Instagram account itself — suspensions, reach, or content decisions.
            Those are Meta's, and I have no visibility into them.
          </Item>
        </div>
      </Section>

      <Section title="Requesting deletion of your data">
        <p>
          Write from the address you sign in with and ask for your account to be deleted — sending it from
          that address is what confirms the request is yours. The{" "}
          <Link to="/data-deletion" className="text-white underline underline-offset-2 hover:text-white/80">
            data deletion page
          </Link>{" "}
          lists exactly what gets removed and has a pre-filled email link.
        </p>
      </Section>

      <Section title="About access to the app">
        <p>
          ViralGrid is a private tool used only by its owner. It is not open to the public, there is no
          sign-up, and accounts are not given out — so please do not write to ask for one. Everything the
          app does is described on the{" "}
          <Link to="/about" className="text-white underline underline-offset-2 hover:text-white/80">about page</Link>.
        </p>
      </Section>

      <Section title="Postal address">
        <p>
          There isn't one to publish — this is a personal project run by an individual, not a registered
          business with premises. If you need a postal address for a formal or legal matter, ask by email
          and it will be provided directly.
        </p>
      </Section>
    </PublicPage>
  );
}
