export interface SiteFiles {
  html: string;
  css: string;
  js: string;
}

interface Preset {
  label: string;
  match: RegExp;
  palette: [string, string];
  eyebrow: string;
  headline: string;
  subhead: string;
  cta: string;
  stats: [number, string, string];
  features: [string, string, string][];
  showcaseTitle: string;
  showcaseIntro: string;
  showcase: [string, string, string][];
  aboutTitle: string;
  about: string;
  aboutPoints: string[];
  testimonials: [string, string][];
  ctaTitle: string;
  ctaText: string;
}

const COLOR_WORDS: Record<string, [string, string]> = {
  blue: ["#2563eb", "#38bdf8"],
  navy: ["#1e3a8a", "#60a5fa"],
  green: ["#15803d", "#a3e635"],
  emerald: ["#059669", "#6ee7b7"],
  red: ["#dc2626", "#fb923c"],
  orange: ["#ea580c", "#fde047"],
  purple: ["#7c3aed", "#f0abfc"],
  indigo: ["#4338ca", "#a5b4fc"],
  pink: ["#db2777", "#fbcfe8"],
  rose: ["#e11d48", "#fecdd3"],
  teal: ["#0f766e", "#5eead4"],
  yellow: ["#ca8a04", "#fef08a"],
  gold: ["#a16207", "#fde68a"],
  black: ["#111827", "#f59e0b"],
};

const PRESETS: Preset[] = [
  {
    label: "Cafe",
    match: /restaurant|cafe|café|coffee|bakery|food|kitchen|pizza|bistro|diner|burger|sushi|bar\b/i,
    palette: ["#92400e", "#f59e0b"],
    eyebrow: "Fresh & made with care",
    headline: "Fresh flavours, served with love",
    subhead: "Hand-crafted dishes, warm drinks and a cozy place to slow down.",
    cta: "View the menu",
    stats: [12, "+", "Years of baking"],
    features: [
      ["🌿", "Locally sourced", "We buy from nearby farms so every bite tastes fresher."],
      ["🥐", "Baked daily", "Breads and pastries come out of the oven every morning."],
      ["☕", "Cozy atmosphere", "Comfortable seats, soft music and free Wi-Fi all day."],
    ],
    showcaseTitle: "Our favourites",
    showcaseIntro: "A few of the dishes guests come back for again and again.",
    showcase: [
      ["Signature latte", "Espresso, steamed milk and house-made vanilla.", "$4.50"],
      ["Sourdough sandwich", "Roasted vegetables, herb spread and aged cheese.", "$9.00"],
      ["Berry cheesecake", "Creamy New York style with a fresh berry compote.", "$6.25"],
    ],
    aboutTitle: "Our story",
    about:
      "We started with one oven and a simple idea: good food should feel like home. Today we still cook everything from scratch.",
    aboutPoints: ["Recipes made from scratch", "Seasonal menu every month", "Friendly, local team"],
    testimonials: [
      ["The best croissants in town. I come here every Saturday!", "Maria L."],
      ["Warm service, great coffee and a menu that keeps changing.", "James K."],
    ],
    ctaTitle: "Reserve your table today",
    ctaText: "Weekend brunch fills up fast. Book a seat and treat yourself.",
  },
  {
    label: "Shop",
    match: /shop|store|boutique|e-?commerce|fashion|clothes|clothing|jewel|products?|market|sell/i,
    palette: ["#be185d", "#f472b6"],
    eyebrow: "New arrivals every week",
    headline: "Style that fits your everyday",
    subhead: "Quality pieces, fair prices and fast delivery straight to your door.",
    cta: "Shop the collection",
    stats: [5000, "+", "Happy customers"],
    features: [
      ["🚚", "Fast delivery", "Free shipping on orders over $50, delivered in 2 days."],
      ["↩️", "Easy returns", "Not the right fit? Send it back within 30 days."],
      ["🔒", "Secure checkout", "Your payment details are encrypted at every step."],
    ],
    showcaseTitle: "Featured products",
    showcaseIntro: "Our most loved picks, chosen by the team.",
    showcase: [
      ["Everyday tote", "Water-resistant canvas with a roomy inside pocket.", "$38"],
      ["Classic denim jacket", "Soft stretch denim that gets better with wear.", "$72"],
      ["Minimal watch", "Slim case, sapphire glass and a leather strap.", "$120"],
    ],
    aboutTitle: "Why shop with us",
    about:
      "We work directly with small makers so you get quality materials and honest prices. Every item is checked before it ships.",
    aboutPoints: ["Ethically made products", "Hand-picked by our team", "Price match guarantee"],
    testimonials: [
      ["Arrived faster than I expected and the quality is excellent.", "Ana R."],
      ["My favourite online store. The sizing guide is spot on.", "Tom W."],
    ],
    ctaTitle: "Get 10% off your first order",
    ctaText: "Join the newsletter and receive a welcome code instantly.",
  },
  {
    label: "Fitness",
    match: /gym|fitness|yoga|workout|training|sport|health|pilates|trainer|coach/i,
    palette: ["#15803d", "#facc15"],
    eyebrow: "Train smarter, feel stronger",
    headline: "Build a stronger version of you",
    subhead: "Personal coaching, group classes and a community that keeps you moving.",
    cta: "Start free trial",
    stats: [350, "+", "Weekly members"],
    features: [
      ["💪", "Expert coaches", "Certified trainers design a plan around your goals."],
      ["🧘", "Group classes", "Yoga, HIIT and strength sessions every day."],
      ["📈", "Track progress", "See your results with simple weekly check-ins."],
    ],
    showcaseTitle: "Programs",
    showcaseIntro: "Pick a program that matches your level and schedule.",
    showcase: [
      ["Strength foundations", "Eight weeks of guided lifts for beginners.", "$29/mo"],
      ["HIIT burn", "Short, intense circuits that fit into lunch breaks.", "$24/mo"],
      ["Mindful yoga", "Flexibility, breathing and recovery for every body.", "$19/mo"],
    ],
    aboutTitle: "Built around you",
    about:
      "Every member starts with a free assessment. We adjust your training as you grow so you always feel challenged, never lost.",
    aboutPoints: ["Free fitness assessment", "Flexible class times", "Nutrition guidance"],
    testimonials: [
      ["I lost 8 kg in four months and I actually enjoy coming in.", "Sam T."],
      ["The coaches push you just the right amount. Highly recommend.", "Lina O."],
    ],
    ctaTitle: "Your first week is on us",
    ctaText: "Try every class for seven days with no commitment.",
  },
  {
    label: "Education",
    match: /course|school|learn|tutor|class(?!ic)|academy|education|teach|students?|lesson|training program/i,
    palette: ["#0369a1", "#84cc16"],
    eyebrow: "Learn at your own pace",
    headline: "Skills that open new doors",
    subhead: "Practical courses taught by people who work in the field every day.",
    cta: "Browse courses",
    stats: [40, "+", "Expert instructors"],
    features: [
      ["🎓", "Certificates", "Earn a recognised certificate when you finish each course."],
      ["🎥", "Video lessons", "Short, focused lessons you can watch on any device."],
      ["🤝", "Community", "Join study groups and get feedback from classmates."],
    ],
    showcaseTitle: "Popular courses",
    showcaseIntro: "Start with one of our most enrolled courses this season.",
    showcase: [
      ["Intro to web design", "Layout, colour and typography from scratch.", "Free"],
      ["Data analysis basics", "Spreadsheets, charts and simple statistics.", "$49"],
      ["Project management", "Plan, track and deliver projects with confidence.", "$79"],
    ],
    aboutTitle: "Why learn here",
    about:
      "Our courses combine short videos, hands-on projects and quizzes so you practise what you learn right away.",
    aboutPoints: ["Learn at your own pace", "Hands-on projects", "Lifetime access"],
    testimonials: [
      ["The projects made everything click. I landed my first freelance job!", "Priya N."],
      ["Clear lessons and a supportive community. Worth every minute.", "Daniel E."],
    ],
    ctaTitle: "Start learning today",
    ctaText: "Enrol in a course and get your first lesson free.",
  },
  {
    label: "Event",
    match: /event|conference|wedding|party|festival|meetup|concert|summit|expo|celebrat/i,
    palette: ["#7e22ce", "#f0abfc"],
    eyebrow: "Save the date",
    headline: "An unforgettable experience awaits",
    subhead: "Speakers, music, great company and memories that last a lifetime.",
    cta: "Get your tickets",
    stats: [2000, "+", "Expected guests"],
    features: [
      ["🎤", "Top speakers", "Hear from leaders who are shaping the future."],
      ["🎶", "Live performances", "Music and entertainment across three stages."],
      ["🍽️", "Food & drinks", "Local vendors serving something for everyone."],
    ],
    showcaseTitle: "Schedule",
    showcaseIntro: "Here is a taste of what happens on the main day.",
    showcase: [
      ["Opening keynote", "09:00 - The vision for the year ahead.", "Main hall"],
      ["Panel: Creators", "12:30 - Stories from the people who make it happen.", "Room B"],
      ["Closing night set", "20:00 - Live music until late.", "Garden stage"],
    ],
    aboutTitle: "About the event",
    about:
      "Every year we bring together people who love what they do. Expect inspiring talks, great food and plenty of time to connect.",
    aboutPoints: ["Free parking on site", "Accessible venue", "Early-bird pricing"],
    testimonials: [
      ["Best event I have attended this year. Already buying next year's ticket!", "Chris M."],
      ["Amazing speakers and a fantastic atmosphere all weekend.", "Nadia F."],
    ],
    ctaTitle: "Early-bird tickets end soon",
    ctaText: "Lock in your seat before prices go up.",
  },
  {
    label: "Portfolio",
    match: /portfolio|designer|photograph|artist|developer|resume|résumé|freelanc|\bcv\b|illustrat|writer|creative/i,
    palette: ["#111827", "#6366f1"],
    eyebrow: "Independent creative",
    headline: "Work that speaks for itself",
    subhead: "Thoughtful design, clean code and projects delivered on time.",
    cta: "See my work",
    stats: [45, "+", "Projects delivered"],
    features: [
      ["🎨", "Thoughtful design", "Every project starts with research and a clear goal."],
      ["⚡", "Clean code", "Fast, accessible and easy to maintain for the long run."],
      ["📅", "On-time delivery", "Clear milestones and honest communication throughout."],
    ],
    showcaseTitle: "Selected projects",
    showcaseIntro: "A few recent projects I am proud of.",
    showcase: [
      ["Brand identity", "Logo, colour system and guidelines for a local brand.", "2025"],
      ["Mobile banking app", "Onboarding and dashboard redesign with user tests.", "2025"],
      ["Editorial website", "Responsive publication with a custom CMS.", "2024"],
    ],
    aboutTitle: "About me",
    about:
      "I help teams turn ideas into polished products. I enjoy working closely with founders and designers to ship things people love.",
    aboutPoints: ["Available for freelance work", "Remote-friendly", "Clear and friendly communication"],
    testimonials: [
      ["Delivered beautifully on time. The team loved working with them.", "Grace A."],
      ["Smart ideas, clean execution and great attention to detail.", "Omar S."],
    ],
    ctaTitle: "Have a project in mind?",
    ctaText: "Tell me about it and I will get back to you within a day.",
  },
  {
    label: "Agency",
    match: /agency|studio|marketing|consult|company|firm|business|service|startup|law|account/i,
    palette: ["#1d4ed8", "#f97316"],
    eyebrow: "Strategy meets execution",
    headline: "We help your business grow",
    subhead: "Marketing, design and technology that deliver measurable results.",
    cta: "Book a call",
    stats: [120, "+", "Clients served"],
    features: [
      ["📊", "Data-led strategy", "Decisions backed by numbers, not guesses."],
      ["🎯", "Targeted campaigns", "Reach the right people at the right moment."],
      ["🛠️", "Hands-on support", "A dedicated team that stays with you after launch."],
    ],
    showcaseTitle: "Our services",
    showcaseIntro: "Everything you need to grow in one place.",
    showcase: [
      ["Brand & design", "Identity, websites and product design.", "From $1,500"],
      ["Growth marketing", "Paid media, SEO and content plans.", "From $900/mo"],
      ["Custom software", "Web apps and integrations built to scale.", "Quote on request"],
    ],
    aboutTitle: "Who we are",
    about:
      "We are a small, senior team that combines creative thinking with technical skill. We treat your goals as our own.",
    aboutPoints: ["Senior-led projects", "Transparent reporting", "Flexible monthly plans"],
    testimonials: [
      ["Our leads doubled within three months. Truly impressive work.", "Ben H."],
      ["They understood our business faster than anyone we have hired.", "Claire D."],
    ],
    ctaTitle: "Ready to grow?",
    ctaText: "Book a free 30-minute strategy call with our team.",
  },
  {
    label: "SaaS",
    match: /saas|software|app\b|application|platform|tool|dashboard|tech|\bai\b|api|startup|product/i,
    palette: ["#4f46e5", "#22d3ee"],
    eyebrow: "Built for modern teams",
    headline: "Ship faster with less effort",
    subhead: "One simple platform to plan, track and automate the work that matters.",
    cta: "Start free",
    stats: [98, "%", "Customer satisfaction"],
    features: [
      ["⚙️", "Automation", "Set up rules once and let the platform handle the rest."],
      ["🔗", "Integrations", "Connect the tools your team already uses every day."],
      ["🛡️", "Secure by default", "Single sign-on, roles and encrypted data as standard."],
    ],
    showcaseTitle: "Simple pricing",
    showcaseIntro: "Start free, upgrade when your team grows.",
    showcase: [
      ["Starter", "Up to 3 users, core features and community support.", "$0"],
      ["Pro", "Unlimited projects, automations and priority support.", "$19/mo"],
      ["Enterprise", "Custom security, SLAs and dedicated onboarding.", "Contact us"],
    ],
    aboutTitle: "Why teams choose us",
    about:
      "We obsess over speed and clarity. Our product stays out of your way so your team can focus on building.",
    aboutPoints: ["Setup in under 5 minutes", "99.9% uptime target", "Export your data anytime"],
    testimonials: [
      ["We cut our weekly reporting time in half in the first month.", "Erin P."],
      ["Finally a tool that people on the team actually enjoy using.", "Victor L."],
    ],
    ctaTitle: "Try it free for 14 days",
    ctaText: "No credit card required. Cancel anytime.",
  },
  {
    label: "Blog",
    match: /blog|journal|magazine|news|articles?|writing|stories/i,
    palette: ["#0f766e", "#f97316"],
    eyebrow: "Fresh stories every week",
    headline: "Ideas worth reading",
    subhead: "Essays, guides and stories from people who love what they write about.",
    cta: "Read the latest",
    stats: [250, "+", "Published articles"],
    features: [
      ["✍️", "Thoughtful writing", "Every post is researched, edited and written to be useful."],
      ["📬", "Weekly newsletter", "Get the best reads delivered to your inbox every Monday."],
      ["💬", "Open discussion", "Share your thoughts in the comments and join the conversation."],
    ],
    showcaseTitle: "Latest posts",
    showcaseIntro: "A few of the stories our readers talk about most.",
    showcase: [
      ["Designing for slow reading", "Why less on screen can make content more memorable.", "6 min read"],
      ["A beginner's guide to habits", "Small routines that compound into big changes.", "9 min read"],
      ["Notes from the road", "Lessons learned from three months working remotely.", "5 min read"],
    ],
    aboutTitle: "About the blog",
    about:
      "We publish honest, practical writing. Every article is written by someone who has done the thing they describe.",
    aboutPoints: ["Written by practitioners", "Clear, jargon-free language", "New posts every week"],
    testimonials: [
      ["Every post feels like a conversation with a friend who knows the subject.", "Rosa M."],
      ["I save articles from here more than from anywhere else.", "Kevin P."],
    ],
    ctaTitle: "Never miss a post",
    ctaText: "Subscribe and get each new article in your inbox.",
  },
  {
    label: "Landing",
    match: /.*/,
    palette: ["#2563eb", "#f59e0b"],
    eyebrow: "Something new is here",
    headline: "Simple, powerful and made for you",
    subhead: "Discover a better way to get things done with a product built around your needs.",
    cta: "Get started",
    stats: [10, "k+", "Happy users"],
    features: [
      ["✨", "Easy to use", "A clean experience that anyone can pick up in minutes."],
      ["🚀", "Fast results", "Get value on day one without a long setup."],
      ["🤝", "Friendly support", "Real people ready to help whenever you need them."],
    ],
    showcaseTitle: "Highlights",
    showcaseIntro: "A quick look at what makes us different.",
    showcase: [
      ["Quality first", "We check every detail before it reaches you.", "Guaranteed"],
      ["Fair pricing", "No hidden fees, ever. What you see is what you pay.", "Transparent"],
      ["Always improving", "Regular updates shaped by your feedback.", "Monthly"],
    ],
    aboutTitle: "About us",
    about:
      "We are a small team with big ambitions. We listen closely, build carefully and keep improving with every release.",
    aboutPoints: ["Built with care", "Responsive on every device", "Designed around users"],
    testimonials: [
      ["Simple, elegant and exactly what I was looking for.", "Alex G."],
      ["The team is responsive and the product keeps getting better.", "Mina J."],
    ],
    ctaTitle: "Ready when you are",
    ctaText: "Join today and see the difference for yourself.",
  },
];

const BONUS_STATS: [number, string, string][] = [
  [4.9, "/5", "Average rating"],
  [99, "%", "Customer satisfaction"],
];

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Pulls a brand name out of phrases like "called Bean & Co" or a quoted name. */
function extractBrand(prompt: string, fallback: string): string {
  const quoted = /["“'‘]([^"”'’]{2,40})["”'’]/.exec(prompt);
  if (quoted) return quoted[1].trim();

  const named = /\b(?:called|named|titled|brand(?:ed)?(?:\s+name)?(?:\s+is)?)\s+([A-Za-z0-9][\w&'.-]*(?:\s+[A-Za-z0-9&'.-]+){0,3})/i.exec(
    prompt,
  );
  if (named) {
    const cut = named[1].split(/\s+(?:with|that|which|using|and|in|on|for|featuring|including|where)\b|[,;!?]/i)[0];
    const clean = cut.replace(/[.]+$/, "").trim();
    if (clean.length >= 2) return clean.slice(0, 40);
  }

  // Otherwise take a capitalised name such as "photographer Lena Park" (skipping generic words)
  const generic = new Set([
    "build", "create", "make", "website", "site", "page", "landing", "modern", "dark", "light",
    "the", "my", "our", "a", "an", "i", "portfolio", "shop", "store", "cafe", "restaurant", "gym",
    "agency", "blue", "red", "green", "purple", "orange", "pink", "teal", "yellow", "gold", "black",
    "navy", "indigo", "rose", "emerald", "attractive", "beautiful", "simple", "minimal", "event",
    "course", "school", "app", "saas", "startup", "web", "new", "online",
  ]);
  const candidates = prompt.match(/[A-Z][A-Za-z&'-]*(?:\s+[A-Z][A-Za-z&'-]*){0,2}/g) ?? [];
  for (const candidate of candidates.slice(0, 6)) {
    const words = candidate.split(/\s+/);
    if (words.every((w) => generic.has(w.toLowerCase()))) continue;
    if (candidate.length >= 2) return candidate.slice(0, 40);
  }

  return fallback;
}

function pickPreset(prompt: string): Preset {
  return PRESETS.find((p) => p.match.test(prompt)) ?? PRESETS[PRESETS.length - 1];
}

function pickPalette(prompt: string, preset: Preset): [string, string] {
  const lower = prompt.toLowerCase();
  for (const word of Object.keys(COLOR_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) return COLOR_WORDS[word];
  }
  return preset.palette;
}

function buildHtml(p: Preset, brand: string, darkByDefault: boolean, prompt: string): string {
  const b = esc(brand);
  const year = new Date().getFullYear();

  const stats: [number, string, string][] = [p.stats, ...BONUS_STATS];
  const statCards = stats
    .map(
      ([value, suffix, label]) => `
        <div class="stat reveal">
          <strong data-count="${value}" data-suffix="${esc(suffix)}">0${esc(suffix)}</strong>
          <span>${esc(label)}</span>
        </div>`,
    )
    .join("");

  const features = p.features
    .map(
      ([icon, title, text]) => `
        <article class="card reveal">
          <div class="icon">${icon}</div>
          <h3>${esc(title)}</h3>
          <p>${esc(text)}</p>
        </article>`,
    )
    .join("");

  const showcase = p.showcase
    .map(
      ([title, text, meta]) => `
        <article class="card reveal">
          <h3>${esc(title)}</h3>
          <p>${esc(text)}</p>
          <span class="meta">${esc(meta)}</span>
        </article>`,
    )
    .join("");

  const points = p.aboutPoints.map((point) => `<li>${esc(point)}</li>`).join("");

  const quotes = p.testimonials
    .map(
      ([quote, name]) => `
        <figure class="card reveal quote">
          <blockquote>“${esc(quote)}”</blockquote>
          <cite>${esc(name)}</cite>
        </figure>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en"${darkByDefault ? ' data-theme="dark"' : ""}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${esc(prompt).slice(0, 160)}" />
  <title>${b}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="site-header">
    <nav class="container nav">
      <a href="#top" class="logo">${b}</a>
      <div class="nav-links" id="nav-links">
        <a href="#features">Why us</a>
        <a href="#showcase">${esc(p.showcaseTitle)}</a>
        <a href="#about">About</a>
        <a href="#testimonials">Reviews</a>
        <a href="#contact">Contact</a>
      </div>
      <div class="nav-actions">
        <button class="icon-btn" id="theme-toggle" type="button" aria-label="Toggle dark mode">🌓</button>
        <button class="icon-btn menu-toggle" id="menu-toggle" type="button" aria-label="Open menu">☰</button>
      </div>
    </nav>
  </header>

  <main id="top">
    <section class="hero">
      <div class="container">
        <span class="eyebrow-pill">${esc(p.eyebrow)}</span>
        <h1>${esc(p.headline)}</h1>
        <p class="lead">${esc(p.subhead)} <strong>${b}</strong> is here to help.</p>
        <div class="actions">
          <a class="btn btn-primary" href="#contact">${esc(p.cta)}</a>
          <a class="btn btn-ghost" href="#features">Learn more</a>
        </div>
      </div>
    </section>

    <div class="container stats">${statCards}
    </div>

    <section id="features">
      <div class="container">
        <div class="section-head reveal">
          <span class="eyebrow">Why choose ${b}</span>
          <h2>Everything you need, nothing you don't</h2>
        </div>
        <div class="grid">${features}
        </div>
      </div>
    </section>

    <section id="showcase" class="alt">
      <div class="container">
        <div class="section-head reveal">
          <span class="eyebrow">${esc(p.showcaseTitle)}</span>
          <h2>${esc(p.showcaseTitle)}</h2>
          <p>${esc(p.showcaseIntro)}</p>
        </div>
        <div class="grid">${showcase}
        </div>
      </div>
    </section>

    <section id="about">
      <div class="container split">
        <div class="reveal">
          <span class="eyebrow">${esc(p.aboutTitle)}</span>
          <h2>${esc(p.aboutTitle)}</h2>
          <p>${esc(p.about)}</p>
          <ul class="checklist">${points}
          </ul>
        </div>
        <div class="about-visual reveal" aria-hidden="true">${esc(brand.charAt(0).toUpperCase())}</div>
      </div>
    </section>

    <section id="testimonials" class="alt">
      <div class="container">
        <div class="section-head reveal">
          <span class="eyebrow">Reviews</span>
          <h2>What people say</h2>
        </div>
        <div class="grid">${quotes}
        </div>
      </div>
    </section>

    <section id="contact">
      <div class="container">
        <div class="cta reveal">
          <h2>${esc(p.ctaTitle)}</h2>
          <p>${esc(p.ctaText)}</p>
        </div>
        <form class="contact-form reveal" id="contact-form">
          <input type="text" name="name" placeholder="Your name" required />
          <input type="email" name="email" placeholder="Your email" required />
          <textarea name="message" rows="4" placeholder="How can we help?"></textarea>
          <button class="btn btn-primary" type="submit">Send message</button>
          <p class="form-status" id="form-status" aria-live="polite"></p>
        </form>
      </div>
    </section>
  </main>

  <footer>
    <div class="container">
      <span>© ${year} ${b}. All rights reserved.</span>
      <span>Built with care.</span>
    </div>
  </footer>

  <script src="script.js"></script>
</body>
</html>
`;
}

function buildCss(primary: string, accent: string): string {
  return `:root {
  --primary: ${primary};
  --accent: ${accent};
  --bg: #f8fafc;
  --surface: #ffffff;
  --alt: #eef2f7;
  --text: #0f172a;
  --muted: #64748b;
  --radius: 16px;
  --shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
}

[data-theme="dark"] {
  --bg: #0b1120;
  --surface: #111a2e;
  --alt: #0f1729;
  --text: #e2e8f0;
  --muted: #94a3b8;
  --shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
}

* { box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  margin: 0;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}

a { color: inherit; text-decoration: none; }

img { max-width: 100%; }

section { padding: 88px 0; scroll-margin-top: 72px; }
section.alt { background: var(--alt); }

h1, h2, h3 { line-height: 1.15; margin: 0 0 12px; }
h2 { font-size: clamp(1.8rem, 3vw, 2.4rem); }

.container { width: min(1120px, 92%); margin: 0 auto; }

.section-head { text-align: center; max-width: 640px; margin: 0 auto 48px; }
.section-head p { color: var(--muted); }

.eyebrow {
  display: inline-block;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--primary);
  margin-bottom: 8px;
}

.eyebrow-pill {
  display: inline-block;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  font-size: 0.9rem;
  margin-bottom: 18px;
}

/* Header */
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid color-mix(in srgb, var(--muted) 20%, transparent);
}

.nav { display: flex; align-items: center; justify-content: space-between; height: 72px; position: relative; }
.logo { font-weight: 800; font-size: 1.2rem; color: var(--primary); }
.nav-links { display: flex; gap: 24px; align-items: center; }
.nav-links a { font-weight: 500; opacity: 0.85; }
.nav-links a:hover { color: var(--primary); opacity: 1; }
.nav-actions { display: flex; gap: 8px; }

.icon-btn {
  background: none;
  border: 1px solid color-mix(in srgb, var(--muted) 35%, transparent);
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
  color: inherit;
  font: inherit;
}

.menu-toggle { display: none; }

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 22px;
  border-radius: 999px;
  font-weight: 600;
  border: 2px solid transparent;
  cursor: pointer;
  font: inherit;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.btn:hover { transform: translateY(-2px); }

.btn-primary {
  background: var(--primary);
  color: #fff;
  box-shadow: 0 10px 24px color-mix(in srgb, var(--primary) 40%, transparent);
}

.btn-ghost { border-color: currentColor; background: transparent; color: inherit; }

/* Hero */
.hero {
  position: relative;
  color: #fff;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  padding: 120px 0 150px;
  overflow: hidden;
}

.hero::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.18), transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.12), transparent 45%);
  pointer-events: none;
}

.hero .container { position: relative; z-index: 1; max-width: 760px; }
.hero h1 { font-size: clamp(2.4rem, 6vw, 4.2rem); font-weight: 800; }
.hero .lead { font-size: 1.15rem; opacity: 0.92; max-width: 580px; }
.hero .actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 28px; }
.hero .btn-primary { background: #fff; color: var(--primary); }
.hero .btn-ghost { color: #fff; border-color: rgba(255, 255, 255, 0.7); }

/* Stats */
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: -64px;
  position: relative;
  z-index: 2;
}

.stat {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 24px;
  text-align: center;
  box-shadow: var(--shadow);
}

.stat strong { display: block; font-size: 2rem; color: var(--primary); }
.stat span { color: var(--muted); }

/* Cards */
.grid { display: grid; gap: 24px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }

.card {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 28px;
  margin: 0;
  box-shadow: var(--shadow);
  border: 1px solid color-mix(in srgb, var(--muted) 15%, transparent);
}

.card p { color: var(--muted); margin: 0; }

.card .icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-size: 1.5rem;
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  margin-bottom: 16px;
}

.card .meta {
  display: inline-block;
  margin-top: 14px;
  font-weight: 700;
  color: var(--primary);
}

.quote blockquote { margin: 0; font-style: italic; }
.quote cite { display: block; margin-top: 14px; font-style: normal; font-weight: 700; color: var(--primary); }

.card:hover { transform: translateY(-6px); transition: transform 0.3s ease; }

/* About */
.split { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
.split p { color: var(--muted); }

.checklist { list-style: none; padding: 0; margin: 20px 0 0; }
.checklist li { padding-left: 28px; position: relative; margin: 10px 0; }
.checklist li::before { content: "✓"; position: absolute; left: 0; color: var(--primary); font-weight: 800; }

.about-visual {
  border-radius: 24px;
  min-height: 320px;
  background: linear-gradient(160deg, var(--primary), var(--accent));
  box-shadow: var(--shadow);
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 6rem;
  font-weight: 800;
}

/* CTA + contact */
.cta {
  background: var(--primary);
  color: #fff;
  text-align: center;
  border-radius: 28px;
  padding: 56px 24px;
  margin-bottom: 48px;
}

.cta p { opacity: 0.9; margin: 0; }

.contact-form { display: grid; gap: 14px; max-width: 560px; margin: 0 auto; }

input, textarea {
  width: 100%;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--muted) 35%, transparent);
  background: var(--surface);
  color: var(--text);
  font: inherit;
}

input:focus, textarea:focus {
  outline: 3px solid color-mix(in srgb, var(--primary) 35%, transparent);
  border-color: var(--primary);
}

.form-status { min-height: 1.4em; color: var(--primary); font-weight: 600; text-align: center; margin: 0; }

/* Footer */
footer {
  padding: 32px 0;
  border-top: 1px solid color-mix(in srgb, var(--muted) 20%, transparent);
  color: var(--muted);
}

footer .container { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; }

/* Scroll reveal */
.reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; }
.reveal.visible { opacity: 1; transform: none; }

/* Responsive */
@media (max-width: 800px) {
  section { padding: 64px 0; }
  .split { grid-template-columns: 1fr; }
  .stats { grid-template-columns: 1fr; margin-top: -32px; }
  .menu-toggle { display: inline-block; }
  .nav-links {
    display: none;
    position: absolute;
    top: 72px;
    left: 0;
    right: 0;
    flex-direction: column;
    background: var(--surface);
    padding: 20px 0;
    box-shadow: var(--shadow);
  }
  .nav-links.open { display: flex; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .reveal { opacity: 1; transform: none; transition: none; }
  .btn, .card { transition: none; }
}
`;
}

const SCRIPT_JS = `(function () {
  'use strict';

  var root = document.documentElement;

  function storeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function storeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ }
  }

  // Theme toggle (remembers the choice)
  var savedTheme = storeGet('site-theme');
  if (savedTheme) { root.setAttribute('data-theme', savedTheme); }

  var themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      storeSet('site-theme', next);
    });
  }

  // Mobile menu
  var menuBtn = document.getElementById('menu-toggle');
  var navLinks = document.getElementById('nav-links');
  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', function () {
      navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('open');
      });
    });
  }

  // Scroll reveal animations
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    reveals.forEach(function (el) { observer.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('visible'); });
  }

  // Count-up statistics
  document.querySelectorAll('[data-count]').forEach(function (el) {
    var target = Number(el.getAttribute('data-count')) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var startTime = null;
    var duration = 1400;

    function step(timestamp) {
      if (startTime === null) { startTime = timestamp; }
      var progress = Math.min((timestamp - startTime) / duration, 1);
      el.textContent = Math.floor(progress * target).toLocaleString() + suffix;
      if (progress < 1) { requestAnimationFrame(step); }
    }

    requestAnimationFrame(step);
  });

  // Contact form (demo: shows a thank-you message)
  var form = document.getElementById('contact-form');
  var status = document.getElementById('form-status');
  if (form && status) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var name = (form.elements['name'].value || '').trim();
      status.textContent = 'Thanks ' + (name || 'there') + '! We will get back to you shortly.';
      form.reset();
    });
  }
})();
`;

/** Generates a complete, responsive three-file website from a plain-English prompt. */
export function buildWebsite(prompt: string, siteType?: string): SiteFiles {
  const cleanPrompt = prompt.trim() || "A modern landing page";
  // A build type chosen by the user wins; otherwise the preset is detected from the description.
  const chosen = siteType
    ? PRESETS.find((p) => p.label.toLowerCase() === siteType.toLowerCase())
    : undefined;
  const preset = chosen ?? pickPreset(cleanPrompt);
  const brand = extractBrand(cleanPrompt, `Your ${preset.label}`);
  const [primary, accent] = pickPalette(cleanPrompt, preset);
  const darkByDefault = /\bdark\b/i.test(cleanPrompt);

  return {
    html: buildHtml(preset, brand, darkByDefault, cleanPrompt),
    css: buildCss(primary, accent),
    js: SCRIPT_JS,
  };
}
