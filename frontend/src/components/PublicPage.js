import { Link } from "react-router-dom";
import Logo from "./Logo";

/** Shared shell for the pages a signed-out visitor (or a Meta reviewer) can read. */

// Single place to change the address used across every public page.
export const CONTACT_EMAIL = "prajjdilip@gmail.com";
export const LAST_UPDATED = "26 July 2026";

export const Section = ({ title, children }) => (
  <section className="mt-10">
    <h2 className="text-lg font-semibold tracking-tight mb-3">{title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-white/70">{children}</div>
  </section>
);

const FOOTER_LINKS = [
  { to: "/about", label: "About" },
  { to: "/privacy", label: "Privacy" },
  { to: "/data-deletion", label: "Data deletion" },
  { to: "/contact", label: "Contact" },
];

export default function PublicPage({ title, updated, intro, children }) {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <header className="border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-2.5">
          <Link to="/about" className="flex items-center gap-2.5">
            <Logo size={20} className="text-white" />
            <span className="tracking-tight font-semibold">ViralGrid</span>
          </Link>
          <Link to="/login" className="ml-auto text-xs text-white/50 hover:text-white transition-colors duration-200">
            Sign in
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 pb-16 w-full flex-1">
        <h1 className="text-3xl sm:text-4xl tracking-tighter font-light">{title}</h1>
        {updated && <p className="text-xs text-white/40 mt-3">Last updated {updated}</p>}
        {intro && <p className="mt-8 text-sm leading-relaxed text-white/70">{intro}</p>}
        {children}
      </main>

      <footer className="border-t border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/40">
          {FOOTER_LINKS.map(({ to, label }) => (
            <Link key={to} to={to} className="hover:text-white transition-colors duration-200">{label}</Link>
          ))}
          <span className="ml-auto">A private tool — not open for public sign-up.</span>
        </div>
      </footer>
    </div>
  );
}
