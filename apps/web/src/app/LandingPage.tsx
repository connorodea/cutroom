import { Icon } from "../components/Icon";

/**
 * Cutroom marketing landing page — Mintlify-inspired: a dark gradient hero with a teal glow
 * that resolves into a floating product shot, then clean light sections. Served at "/".
 */

const ACCENT = "#4FD1C5";
const INK = "#0F1115";
const MUTED = "#6B7177";
const APP_URL = "/app";

const HERO_BG =
  "radial-gradient(130% 90% at 50% -10%, rgba(79,209,197,0.22), rgba(79,209,197,0) 52%)," +
  "radial-gradient(80% 60% at 80% 10%, rgba(91,91,214,0.16), rgba(91,91,214,0) 60%)," +
  "linear-gradient(180deg, #090B0C 0%, #0C0E10 55%, #131619 100%)";

const FEATURES: { icon: string; tag: string; title: string; body: string }[] = [
  { icon: "wand-2", tag: "Create", title: "Prompt → finished video", body: "Describe an idea. Cutroom writes the narration, finds footage matched to each scene, voices it, and captions it." },
  { icon: "captions", tag: "Edit", title: "Edit by transcript", body: "Transcribe and edit video like a document — strike a word, the footage and audio cut with it. Descript-style, in your browser." },
  { icon: "layers", tag: "Graphics", title: "AI on-screen graphics", body: "Titles, lower thirds, callouts, and badges — designed by the AI and composited in, aligned to the words." },
  { icon: "sparkles", tag: "Generative", title: "Generate your footage", body: "Out of stock options? Generate scenes with Higgsfield — text → image → video — woven into the same timeline." },
  { icon: "scissors", tag: "Clean up", title: "Cut the dead air", body: "One pass removes silences and filler words, normalizes loudness, and burns captions. Upload and download a tighter cut." },
  { icon: "activity", tag: "Platform", title: "Drive it with agents", body: "Every capability is a public API with an SDK, a CLI, and an MCP server — so your own agents can make video too." },
];

const STEPS: { n: string; title: string; body: string }[] = [
  { n: "01", title: "Script", body: "The AI breaks your idea into scenes — a spoken line and a visual for each." },
  { n: "02", title: "Footage", body: "Each scene is matched to stock or generated, then cut to the voiceover." },
  { n: "03", title: "Voice & captions", body: "A narration track is synthesized and word-aligned captions are burned in." },
  { n: "04", title: "Graphics", body: "Titles and lower thirds are designed and composited — and it's done." },
];

function Nav() {
  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 28px", background: "rgba(9,11,12,0.6)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 26, height: 26, borderRadius: 9, background: "linear-gradient(150deg,#4FD1C5,#2E9C95)", display: "flex", alignItems: "center", justifyContent: "center", color: "#08110F" }}>
          <Icon name="clapperboard" size={15} />
        </span>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em", color: "#F5F5F7" }}>Cutroom</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 26, fontSize: 13.5, color: "#A7ADB3" }}>
        <a href="#features" style={{ color: "inherit", textDecoration: "none" }}>Features</a>
        <a href="#pipeline" style={{ color: "inherit", textDecoration: "none" }}>How it works</a>
        <a href="#platform" style={{ color: "inherit", textDecoration: "none" }}>Platform</a>
      </div>
      <a href={APP_URL} style={{ display: "flex", alignItems: "center", gap: 7, background: ACCENT, color: "#06100E", borderRadius: 10, padding: "8px 15px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
        Open editor <Icon name="arrow-up-right" size={14} />
      </a>
    </nav>
  );
}

function Hero() {
  return (
    <header style={{ background: HERO_BG, padding: "0 24px", overflow: "hidden" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", textAlign: "center", paddingTop: 86 }}>
        <a href={APP_URL} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(79,209,197,0.10)", border: "1px solid rgba(79,209,197,0.28)", color: ACCENT, borderRadius: 999, padding: "5px 13px 5px 9px", fontSize: 12.5, textDecoration: "none", marginBottom: 26 }}>
          <span style={{ background: ACCENT, color: "#06100E", borderRadius: 999, padding: "1px 7px", fontSize: 10.5, fontWeight: 700 }}>NEW</span>
          AI Create + generative footage <Icon name="arrow-up-right" size={13} />
        </a>
        <h1 style={{ fontSize: "clamp(40px, 6vw, 68px)", lineHeight: 1.04, letterSpacing: "-0.035em", fontWeight: 700, color: "#FBFCFC", margin: 0 }}>
          The AI-native<br />video editor
        </h1>
        <p style={{ maxWidth: 560, margin: "22px auto 0", fontSize: "clamp(15px, 2vw, 18px)", lineHeight: 1.55, color: "#9AA1A8" }}>
          Describe a video and Cutroom writes the script, finds the footage, voices it, captions it, and designs the graphics — or edit your own footage by transcript.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 30, flexWrap: "wrap" }}>
          <a href={APP_URL} style={{ display: "flex", alignItems: "center", gap: 8, background: ACCENT, color: "#06100E", borderRadius: 12, padding: "12px 22px", fontSize: 14.5, fontWeight: 600, textDecoration: "none" }}>
            Open the editor <Icon name="arrow-up-right" size={16} />
          </a>
          <a href="#pipeline" style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.14)", color: "#E6E8EA", borderRadius: 12, padding: "12px 20px", fontSize: 14.5, fontWeight: 500, textDecoration: "none" }}>
            See how it works
          </a>
        </div>
      </div>

      {/* floating product shot, resolving out of the gradient */}
      <div style={{ maxWidth: 1080, margin: "54px auto -120px", padding: "0 4px" }}>
        <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 40px 120px -30px rgba(0,0,0,0.85), 0 0 0 1px rgba(79,209,197,0.06)", background: "#161618" }}>
          <img src="/hero.png" alt="The Cutroom editor" style={{ display: "block", width: "100%", height: "auto" }} />
        </div>
      </div>
    </header>
  );
}

function TechStrip() {
  const names = ["OpenAI", "Whisper", "Pexels", "Higgsfield", "Anthropic"];
  return (
    <section style={{ background: "#fff", padding: "150px 24px 24px" }}>
      <p style={{ textAlign: "center", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9AA1A8", margin: "0 0 18px" }}>
        The pipeline runs on
      </p>
      <div style={{ display: "flex", gap: "34px 48px", justifyContent: "center", flexWrap: "wrap" }}>
        {names.map((n) => (
          <span key={n} style={{ fontSize: 17, fontWeight: 600, color: "#B6BCC2", letterSpacing: "-0.01em" }}>{n}</span>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" style={{ background: "#fff", padding: "64px 24px 36px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", letterSpacing: "-0.03em", fontWeight: 700, color: INK, margin: 0 }}>Built for the AI age</h2>
        <p style={{ fontSize: 16, lineHeight: 1.55, color: MUTED, margin: "14px auto 0", maxWidth: 560 }}>
          From a blank prompt to a finished cut — every step woven into one place, for people and for agents.
        </p>
      </div>
      <div style={{ maxWidth: 1080, margin: "44px auto 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        {FEATURES.map((f) => (
          <div key={f.title} style={{ background: "#FAFBFB", border: "1px solid #ECEEF0", borderRadius: 16, padding: "22px 22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(79,209,197,0.12)", color: "#2E9C95", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={f.icon} size={18} />
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#2E9C95" }}>{f.tag}</span>
            </div>
            <div style={{ fontSize: 16.5, fontWeight: 600, color: INK, marginBottom: 7, letterSpacing: "-0.01em" }}>{f.title}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: MUTED }}>{f.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pipeline() {
  return (
    <section id="pipeline" style={{ background: "#F5F6F7", padding: "72px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2E9C95" }}>The Create pipeline</span>
        <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-0.03em", fontWeight: 700, color: INK, margin: "10px 0 0" }}>From a sentence to a cut</h2>
      </div>
      <div style={{ maxWidth: 1040, margin: "42px auto 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {STEPS.map((s) => (
          <div key={s.n} style={{ background: "#fff", border: "1px solid #E7E9EB", borderRadius: 16, padding: "22px 20px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", marginBottom: 12 }}>{s.n}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: INK, marginBottom: 7 }}>{s.title}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, color: MUTED }}>{s.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section id="platform" style={{ background: HERO_BG, padding: "84px 24px", textAlign: "center" }}>
      <h2 style={{ fontSize: "clamp(28px, 4.5vw, 46px)", letterSpacing: "-0.035em", fontWeight: 700, color: "#FBFCFC", margin: 0 }}>
        Make your next video in minutes
      </h2>
      <p style={{ fontSize: 16.5, color: "#9AA1A8", margin: "16px auto 0", maxWidth: 520, lineHeight: 1.55 }}>
        Open the editor and type a prompt — or wire Cutroom into your own agents with the SDK, CLI, and MCP server.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
        <a href={APP_URL} style={{ display: "flex", alignItems: "center", gap: 8, background: ACCENT, color: "#06100E", borderRadius: 12, padding: "12px 24px", fontSize: 14.5, fontWeight: 600, textDecoration: "none" }}>
          Open the editor <Icon name="arrow-up-right" size={16} />
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ background: "#0A0C0D", padding: "28px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, color: "#A7ADB3" }}>
        <span style={{ width: 22, height: 22, borderRadius: 8, background: "linear-gradient(150deg,#4FD1C5,#2E9C95)", display: "flex", alignItems: "center", justifyContent: "center", color: "#08110F" }}>
          <Icon name="clapperboard" size={13} />
        </span>
        <span style={{ fontWeight: 600, fontSize: 14, color: "#E6E8EA" }}>Cutroom</span>
        <span style={{ fontSize: 12.5, color: "#6B7177" }}>· the AI-native video editor</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#6B7177" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3FB68A" }} />
        All systems normal
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#fff", color: INK, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" }}>
      <Nav />
      <Hero />
      <TechStrip />
      <Features />
      <Pipeline />
      <CTA />
      <Footer />
    </div>
  );
}
