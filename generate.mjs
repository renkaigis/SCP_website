import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const BACKUP = join(
  ROOT,
  "isscpi/backups/isscpi_public_backup_20260527_002951"
);
const API = join(BACKUP, "metadata/wp-json/collections");
const SOURCE_UPLOADS = join(
  BACKUP,
  "site/isscpi.com/wp-content/uploads"
);
const SITE_URL = "https://scp.renkaigis.cn";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const pages = await readJson(join(API, "pages/page-001.json"));
const posts = await readJson(join(API, "posts/page-001.json"));
const media = await readJson(join(API, "media/page-001.json"));

const mediaById = new Map(media.map((item) => [item.id, item]));

const navItems = [
  { label: "About", href: "/aboutus/" },
  { label: "Governance", href: "/governance/" },
  { label: "Task Groups", href: "/task-groups/" },
  { label: "Membership", href: "/membership/" },
  { label: "Awards", href: "/awards/" },
  { label: "Conferences", href: "/conference/" },
  { label: "Journals", href: "/journals/" },
];

const taskGroups = [
  {
    number: "01",
    title: "Geospatial Intelligence",
    description:
      "Spatial analytics and learning algorithms for smarter buildings and infrastructure.",
    href: "/task-groups/task-group-1-geospatial-intelligence-for-smart-buildings-and-infrastructure/",
  },
  {
    number: "02",
    title: "Smart Site Safety",
    description:
      "Smart technologies that improve construction safety and occupational health.",
    href: "/task-groups/task-group-2-smart-site-safety-3s/",
  },
  {
    number: "03",
    title: "Future-Ready Education",
    description:
      "Curricula, teaching methods and industry links for the next construction workforce.",
    href: "/task-groups/task-group-3-future-ready-construction-education/",
  },
  {
    number: "04",
    title: "Sustainable Materials",
    description:
      "Eco-efficient cementitious composites and intelligent construction technologies.",
    href: "/task-groups/task-group-4-sustainable-cementitious-materials-and-intelligent-construction/",
  },
  {
    number: "05",
    title: "Circular Construction",
    description:
      "Digital twins, BIM and smart systems enabling material reuse and circularity.",
    href: "/task-group-5-circularity-in-construction-through-smart-technologies/",
  },
];

const pageDescriptions = {
  aboutus:
    "Our history, mission, vision and commitment to advancing smart construction and production.",
  governance:
    "Meet the distinguished leaders guiding SCP's international research and professional community.",
  "task-groups":
    "Collaborative research groups addressing the defining challenges of the built environment.",
  membership:
    "Join a global network of researchers, professionals and industry leaders.",
  awards:
    "Recognising people, technologies and collaborations shaping the future of construction and production.",
  conference:
    "The International Conference on Innovative Production and Construction series.",
  journals:
    "Selected publications advancing research across smart construction and production.",
  "contact-us": "Connect with the SCP secretariat and international community.",
  ipc2026:
    "19-20 November 2026 at the Melbourne Convention and Exhibition Centre, Australia.",
  "2025-scp-award-ceremony":
    "Celebrating achievement, innovation, collaboration and impact across the SCP community.",
  "task-group-1-geospatial-intelligence-for-smart-buildings-and-infrastructure":
    "Geospatial intelligence and learning algorithms for smarter buildings and infrastructure.",
  "task-group-2-smart-site-safety-3s":
    "Advancing construction safety and occupational health through smart technologies.",
  "task-group-3-future-ready-construction-education":
    "Preparing the next generation for digital, sustainable and resilient construction.",
  "task-group-4-sustainable-cementitious-materials-and-intelligent-construction":
    "Eco-efficient cementitious materials, sensing and intelligent construction.",
  "task-group-5-circularity-in-construction-through-smart-technologies":
    "Enabling circular construction through BIM, digital twins and smart systems.",
  "submit-nominations":
    "Award nomination guidance, required documents and submission information.",
  payment: "Conference registration payment information and terms.",
};

function decodeEntities(value = "") {
  const entities = {
    "&amp;": "&",
    "&#038;": "&",
    "&#38;": "&",
    "&nbsp;": " ",
    "&#8211;": "-",
    "&#8212;": "-",
    "&#8216;": "'",
    "&#8217;": "'",
    "&#8220;": '"',
    "&#8221;": '"',
    "&#8230;": "...",
    "&hellip;": "...",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
  };

  return value
    .replace(
      /&(amp|nbsp|hellip|lt|gt|quot);|&#(?:038|38|8211|8212|8216|8217|8220|8221|8230);/g,
      (match) => entities[match] ?? match
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function stripHtml(value = "") {
  return decodeEntities(
    localizeUrl(value)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value = "") {
  return decodeEntities(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function localizeUrl(value = "") {
  const taskGroupAliases = [
    [
      "/task-group-1-geospatial-intelligence-for-smart-buildings-and-infrastructure/",
      "/task-groups/task-group-1-geospatial-intelligence-for-smart-buildings-and-infrastructure/",
    ],
    [
      "/task-group-2-smart-site-safety-3s/",
      "/task-groups/task-group-2-smart-site-safety-3s/",
    ],
    [
      "/task-group-3-future-ready-construction-education/",
      "/task-groups/task-group-3-future-ready-construction-education/",
    ],
    [
      "/task-group-4-sustainable-cementitious-materials-and-intelligent-construction/",
      "/task-groups/task-group-4-sustainable-cementitious-materials-and-intelligent-construction/",
    ],
  ];

  let localized = value
    .replace(
      /https?:\/\/(?:www\.)?isscpi\.com\/wp-content\/uploads\//gi,
      "/assets/uploads/"
    )
    .replace(/https?:\/\/(?:www\.)?isscpi\.com\/?/gi, "/")
    .replace(/\/2024\/06\/02\/xiangyu-wang\//g, "/2024/06/28/xiangyu-wang/")
    .replace(/\/2024\/06\/02\/vijay-singh\//g, "/2024/07/02/vijay-singh/")
    .replace(
      /\/2024\/06\/02\/konrad-bergmeister\//g,
      "/2024/06/29/konrad-bergmeister/"
    );

  for (const [from, to] of taskGroupAliases) {
    localized = localized.replaceAll(from, to);
  }

  return localized;
}

function sanitizeContent(value, slug) {
  let html = value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "")
    .replace(/\s(?:srcset|sizes|data-[\w-]+|onclick)="[^"]*"/gi, "")
    .replace(/\sstyle="[^"]*"/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/<div[^>]*class="[^"]*wp-block-spacer[^"]*"[^>]*><\/div>/gi, "")
    .replace(/<p>\s*<\/p>/gi, "");

  html = localizeUrl(html);
  html = html.replace(/<img(?![^>]*\bloading=)([^>]*)>/gi, '<img loading="lazy"$1>');
  html = html.replace(
    /<a([^>]*target="_blank"[^>]*)>/gi,
    (match, attrs) =>
      /rel=/.test(attrs)
        ? match
        : `<a${attrs} rel="noopener noreferrer">`
  );

  if (slug === "payment") {
    html = html.replace(
      /<p[^>]*has-red-color[^>]*>[\s\S]*?<\/p>/i,
      ""
    );
    html =
      `<aside class="notice"><strong>Online payment is currently offline.</strong><p>The archived page contained test payment controls for IPC2025. Please contact the SCP secretariat before making any conference payment.</p><a class="text-link" href="mailto:secretary@isscpi.com">Email secretary@isscpi.com &rarr;</a></aside>` +
      html;
  }

  return html;
}

function pagePath(item) {
  return new URL(item.link).pathname;
}

function outputFile(pathname) {
  const clean = pathname.replace(/^\/+|\/+$/g, "");
  return clean ? join(ROOT, clean, "index.html") : join(ROOT, "index.html");
}

async function writeRoute(pathname, html) {
  const destination = outputFile(pathname);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, html);
}

function titleFor(item) {
  return decodeEntities(item.title.rendered).trim();
}

function descriptionFor(item) {
  return (
    pageDescriptions[item.slug] ||
    stripHtml(item.excerpt?.rendered || item.content?.rendered || "").slice(0, 180)
  );
}

function activeNav(href, currentPath) {
  if (href === "/aboutus/" && currentPath.startsWith("/2024/")) return false;
  return currentPath === href || currentPath.startsWith(href);
}

function header(currentPath = "/") {
  const nav = navItems
    .map(
      (item) =>
        `<a href="${item.href}"${activeNav(item.href, currentPath) ? ' aria-current="page"' : ""}>${item.label}</a>`
    )
    .join("");

  return `
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="utility-bar">
        <div class="shell utility-inner">
          <span>International Society for Smart Construction &amp; Production</span>
          <nav aria-label="Utility navigation">
            <a href="/news/">News</a>
            <a href="/contact-us/">Contact</a>
            <a href="mailto:secretary@isscpi.com">Email</a>
          </nav>
        </div>
      </div>
      <div class="shell brand-row">
        <a class="brand" href="/" aria-label="SCP home">
          <img src="/assets/uploads/2024/07/Artboard-1.png" alt="International Society for Smart Construction and Production">
        </a>
        <div class="header-actions">
          <a class="search-link" href="/search/">Search</a>
          <a class="button button-small" href="/membership/">Join SCP</a>
          <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-navigation">
            <span></span><span></span><span></span>
            <span class="sr-only">Toggle navigation</span>
          </button>
        </div>
      </div>
      <nav class="primary-navigation" id="primary-navigation" aria-label="Primary navigation">
        <div class="shell nav-inner">${nav}</div>
      </nav>
    </header>`;
}

function footer() {
  return `
    <footer class="site-footer">
      <div class="shell footer-grid">
        <div class="footer-brand">
          <img src="/assets/uploads/2024/07/logo_title_w.png" alt="SCP">
          <p>Advancing innovation, collaboration and knowledge across smart construction and production.</p>
        </div>
        <div>
          <h2>Explore</h2>
          <a href="/aboutus/">About SCP</a>
          <a href="/governance/">Governance</a>
          <a href="/task-groups/">Task Groups</a>
          <a href="/journals/">Journals</a>
        </div>
        <div>
          <h2>Participate</h2>
          <a href="/membership/">Membership</a>
          <a href="/conference/">Conferences</a>
          <a href="/awards/">Awards</a>
          <a href="/contact-us/">Contact</a>
        </div>
        <div>
          <h2>Connect</h2>
          <a href="mailto:secretary@isscpi.com">secretary@isscpi.com</a>
          <a href="https://www.linkedin.com/company/isscp" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          <a href="https://www.facebook.com/profile.php?id=61561928251367" target="_blank" rel="noopener noreferrer">Facebook</a>
          <a href="https://x.com/Society_SCP" target="_blank" rel="noopener noreferrer">X</a>
        </div>
      </div>
      <div class="shell footer-bottom">
        <span>&copy; ${new Date().getFullYear()} International Society for Smart Construction &amp; Production</span>
        <a href="/sitemap.xml">Sitemap</a>
      </div>
    </footer>`;
}

function layout({
  title,
  description,
  path,
  body,
  bodyClass = "",
  image = "/assets/uploads/2024/07/construction01-1536x976.jpg",
}) {
  const pageTitle =
    title === "Home"
      ? "Smart Construction and Production | SCP"
      : `${title} | SCP`;
  const canonical = `${SITE_URL}${path}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "International Society for Smart Construction and Production",
    alternateName: "SCP",
    url: SITE_URL,
    logo: `${SITE_URL}/assets/uploads/2024/07/Artboard-1.png`,
    email: "secretary@isscpi.com",
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${SITE_URL}${image}">
  <link rel="icon" href="/assets/uploads/2024/07/cropped-icon-1-32x32.png" sizes="32x32">
  <link rel="stylesheet" href="/assets/css/site.css">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <script src="/assets/js/site.js" defer></script>
</head>
<body class="${bodyClass}">
  ${header(path)}
  ${body}
  ${footer()}
</body>
</html>`;
}

function pageHero(item, path) {
  const title = titleFor(item);
  const description = descriptionFor(item);
  const section =
    path.startsWith("/task-group") || path.startsWith("/task-groups/")
      ? "Research"
      : path.startsWith("/ipc") || path.startsWith("/conference")
        ? "Events"
        : path.startsWith("/awards")
          ? "Recognition"
          : "SCP";

  return `
    <section class="page-hero">
      <div class="shell">
        <div class="breadcrumbs"><a href="/">Home</a><span>/</span><span>${section}</span></div>
        <p class="eyebrow">${section}</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="page-intro">${escapeHtml(description)}</p>
      </div>
    </section>`;
}

function customContactContent() {
  return `
    <div class="contact-grid">
      <section>
        <p class="eyebrow">General enquiries</p>
        <h2>Start a conversation with SCP</h2>
        <p>Questions about membership, conferences, awards, publications or task groups are welcome. The secretariat will direct your enquiry to the appropriate committee.</p>
        <a class="button" href="mailto:secretary@isscpi.com?subject=SCP%20website%20enquiry">Email the secretariat</a>
      </section>
      <aside class="contact-details">
        <h2>Contact</h2>
        <dl>
          <dt>Email</dt><dd><a href="mailto:secretary@isscpi.com">secretary@isscpi.com</a></dd>
          <dt>LinkedIn</dt><dd><a href="https://www.linkedin.com/company/isscp">International Society for SCP</a></dd>
          <dt>Social</dt><dd><a href="https://x.com/Society_SCP">@Society_SCP</a></dd>
        </dl>
      </aside>
    </div>`;
}

function customNominationContent() {
  return `
    <aside class="notice"><strong>Static archive notice</strong><p>The former WordPress nomination form required server-side processing and is not active in this static edition. Prepare the documents below and email the secretariat for the current submission route.</p></aside>
    <div class="steps">
      <section><span>01</span><h2>Select an award category</h2><p>Lifetime Achievement, Young Professional, Excellence in Collaboration, Emerging Technology, Community Impact, Smart Construction, Smart Production, Digital Transformation, or Robotics in Construction.</p></section>
      <section><span>02</span><h2>Provide nominee details</h2><p>Include the nominator and nominee names, email addresses, affiliations, positions and a clear award category.</p></section>
      <section><span>03</span><h2>Prepare required documents</h2><p>Provide the nominee CV or relevant project documentation, together with the completed nomination form.</p></section>
      <section><span>04</span><h2>Submit to the secretariat</h2><p>Confirm the current deadline and submission method before sending confidential material.</p></section>
    </div>
    <div class="action-band">
      <div><p class="eyebrow">Nomination resources</p><h2>Download the archived template</h2></div>
      <div class="action-band-links">
        <a class="button button-light" href="/assets/uploads/2025/04/Nomination-Letter-Template-2025_1.docx">Download template</a>
        <a class="text-link light" href="mailto:secretary@isscpi.com?subject=SCP%20award%20nomination">Contact the secretariat &rarr;</a>
      </div>
    </div>`;
}

function articleBody(item, type) {
  const path = pagePath(item);
  const title = titleFor(item);
  const content =
    item.slug === "contact-us"
      ? customContactContent()
      : item.slug === "submit-nominations"
        ? customNominationContent()
        : sanitizeContent(item.content.rendered, item.slug);
  const meta =
    type === "post"
      ? `<div class="article-meta"><time datetime="${item.date}">${new Intl.DateTimeFormat("en", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(item.date))}</time><span>From the SCP archive</span></div>`
      : "";

  return `
    <main id="main">
      ${pageHero(item, path)}
      <div class="shell article-layout">
        <article class="article-content">
          ${meta}
          ${content}
        </article>
        <aside class="article-aside">
          <div class="aside-section">
            <p class="eyebrow">SCP</p>
            <h2>Build the future with us</h2>
            <p>Connect with an international community advancing smarter, safer and more sustainable construction.</p>
            <a class="text-link" href="/membership/">Explore membership &rarr;</a>
          </div>
          <div class="aside-section">
            <h2>Quick links</h2>
            <a href="/ipc2026/">IPC2026</a>
            <a href="/task-groups/">Task Groups</a>
            <a href="/awards/">Awards</a>
            <a href="/contact-us/">Contact</a>
          </div>
        </aside>
      </div>
    </main>`;
}

function featureCard({ label, title, description, href, image }) {
  return `
    <article class="feature-card">
      <a class="feature-image" href="${href}">
        <img src="${image}" alt="" loading="lazy">
      </a>
      <div class="feature-copy">
        <p class="eyebrow">${label}</p>
        <h3><a href="${href}">${title}</a></h3>
        <p>${description}</p>
        <a class="text-link" href="${href}">Explore &rarr;</a>
      </div>
    </article>`;
}

function homeBody() {
  const latestCards = [
    {
      label: "Conference",
      title: "IPC2026 comes to Melbourne",
      description:
        "Join researchers, practitioners and policymakers on 19-20 November 2026.",
      href: "/ipc2026/",
      image: "/assets/uploads/2026/03/image-1.jpeg",
    },
    {
      label: "Awards",
      title: "Celebrating the 2025 SCP award recipients",
      description:
        "Recognising achievement, innovation, collaboration and community impact.",
      href: "/awards/2025-scp-award-ceremony/",
      image: "/assets/uploads/2025/12/2025_award_02-1200x648.jpg",
    },
    {
      label: "Research",
      title: "Circularity through smart technologies",
      description:
        "SCP's fifth task group advances circular economy practice across construction.",
      href: "/task-group-5-circularity-in-construction-through-smart-technologies/",
      image: "/assets/uploads/2024/06/building-1200x800.jpg",
    },
  ];

  return `
    <main id="main">
      <section class="home-hero">
        <img class="hero-background" src="/assets/uploads/2024/07/construction01-1536x976.jpg" alt="Aerial view of a major urban construction project">
        <div class="hero-shade"></div>
        <div class="shell hero-content">
          <p class="eyebrow">International Society for Smart Construction &amp; Production</p>
          <h1>Building intelligence into the future.</h1>
          <p>SCP connects research, industry and government to advance safer, more sustainable and more productive built environments.</p>
          <div class="hero-actions">
            <a class="button button-light" href="/aboutus/">Discover SCP</a>
            <a class="text-link light" href="/membership/">Join our global community &rarr;</a>
          </div>
        </div>
      </section>

      <section class="event-ribbon">
        <div class="shell event-ribbon-inner">
          <div class="event-date"><strong>19-20</strong><span>Nov<br>2026</span></div>
          <div>
            <p class="eyebrow">Featured event</p>
            <h2>12th International Conference on Innovative Production and Construction</h2>
            <p>Melbourne Convention and Exhibition Centre, Australia</p>
          </div>
          <a class="button" href="/ipc2026/">Explore IPC2026</a>
        </div>
      </section>

      <section class="section">
        <div class="shell intro-grid">
          <div>
            <p class="eyebrow">Our purpose</p>
            <h2 class="display-heading">Engineering progress through shared intelligence.</h2>
          </div>
          <div class="intro-copy">
            <p>We bring together leading minds in academia, industry and government to turn emerging technologies into practical progress for construction and production.</p>
            <a class="text-link" href="/aboutus/">Our mission and history &rarr;</a>
          </div>
        </div>
        <div class="shell stat-row">
          <div><strong>5</strong><span>International task groups</span></div>
          <div><strong>12th</strong><span>IPC conference in 2026</span></div>
          <div><strong>Global</strong><span>Academic and industry network</span></div>
        </div>
      </section>

      <section class="section section-muted">
        <div class="shell section-heading">
          <div><p class="eyebrow">Latest</p><h2>Ideas, events and recognition</h2></div>
          <a class="text-link" href="/news/">View all updates &rarr;</a>
        </div>
        <div class="shell feature-grid">${latestCards.map(featureCard).join("")}</div>
      </section>

      <section class="section research-section">
        <div class="shell research-layout">
          <div class="research-intro">
            <p class="eyebrow">Collaborative research</p>
            <h2>Task groups focused on real-world impact.</h2>
            <p>Our international task groups create focused platforms for research exchange, industry adoption and emerging professional leadership.</p>
            <a class="button" href="/task-groups/">Meet the task groups</a>
          </div>
          <div class="task-list">
            ${taskGroups
              .map(
                (group) => `
                <a href="${group.href}">
                  <span>${group.number}</span>
                  <div><h3>${group.title}</h3><p>${group.description}</p></div>
                  <b aria-hidden="true">&rarr;</b>
                </a>`
              )
              .join("")}
          </div>
        </div>
      </section>

      <section class="section journal-section">
        <div class="shell journal-layout">
          <div class="journal-covers">
            <img src="/assets/uploads/2025/09/jbde_cover_new.png" alt="Journal of Building Design and Environment cover" loading="lazy">
            <img src="/assets/uploads/2024/07/Civil-Engineering-Design.png" alt="Civil Engineering Design journal cover" loading="lazy">
          </div>
          <div>
            <p class="eyebrow">Knowledge exchange</p>
            <h2>Research that moves the field forward.</h2>
            <p>SCP supports the dissemination of high-quality research across smart design, engineering, construction, production and the built environment.</p>
            <a class="button" href="/journals/">Explore journals</a>
          </div>
        </div>
      </section>

      <section class="join-section">
        <img src="/assets/uploads/2024/06/building-1536x1024.jpg" alt="" loading="lazy">
        <div class="join-shade"></div>
        <div class="shell join-content">
          <p class="eyebrow">Membership</p>
          <h2>Join the people shaping what comes next.</h2>
          <p>Access a global network, research exchange, professional development, conferences and leadership opportunities.</p>
          <a class="button button-light" href="/membership/">Become a member</a>
        </div>
      </section>
    </main>`;
}

function newsBody() {
  const filtered = posts.filter(
    (post) => !post.slug.startsWith("task-group-")
  );
  const cards = filtered
    .map((post) => {
      const mediaItem = mediaById.get(post.featured_media);
      const image = mediaItem
        ? localizeUrl(mediaItem.source_url)
        : "/assets/uploads/2024/07/construction01-768x488.jpg";
      const path = pagePath(post);
      return `
        <article class="news-card">
          <a class="news-image" href="${path}"><img src="${image}" alt="" loading="lazy"></a>
          <div>
            <p class="eyebrow">${new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(post.date))}</p>
            <h2><a href="${path}">${escapeHtml(titleFor(post))}</a></h2>
            <p>${escapeHtml(stripHtml(post.excerpt.rendered).replace(/Continue reading.*$/, "").slice(0, 220))}</p>
            <a class="text-link" href="${path}">Read more &rarr;</a>
          </div>
        </article>`;
    })
    .join("");

  return `
    <main id="main">
      <section class="page-hero"><div class="shell"><div class="breadcrumbs"><a href="/">Home</a><span>/</span><span>News</span></div><p class="eyebrow">SCP archive</p><h1>News &amp; perspectives</h1><p class="page-intro">Announcements, leadership profiles, conference updates and messages from the SCP community.</p></div></section>
      <section class="section"><div class="shell news-grid">${cards}</div></section>
    </main>`;
}

function searchBody() {
  return `
    <main id="main">
      <section class="page-hero"><div class="shell"><div class="breadcrumbs"><a href="/">Home</a><span>/</span><span>Search</span></div><p class="eyebrow">Find content</p><h1>Search SCP</h1><p class="page-intro">Search pages, task groups, events, awards, publications and archived updates.</p></div></section>
      <section class="section">
        <div class="shell search-page">
          <form class="site-search" role="search">
            <label for="search-input">Search the website</label>
            <div><input id="search-input" type="search" autocomplete="off" placeholder="Try 'IPC2026' or 'site safety'"><button class="button" type="submit">Search</button></div>
          </form>
          <p class="search-status" id="search-status">Enter a term to search the SCP website.</p>
          <div class="search-results" id="search-results"></div>
        </div>
      </section>
    </main>`;
}

function redirectBody(target) {
  return `
    <main id="main" class="not-found">
      <div class="shell">
        <p class="eyebrow">Redirect</p>
        <h1>This SCP page has moved.</h1>
        <p>The content is now available at its task group URL.</p>
        <a class="button" href="${target}">Open the page</a>
      </div>
    </main>`;
}

function redirectLayout(from, to) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page moved | SCP</title>
  <meta http-equiv="refresh" content="0; url=${to}">
  <link rel="canonical" href="${SITE_URL}${to}">
  <link rel="stylesheet" href="/assets/css/site.css">
  <script src="/assets/js/site.js" defer></script>
</head>
<body>
  ${header(from)}
  ${redirectBody(to)}
  ${footer()}
</body>
</html>`;
}

const allContent = [...pages, ...posts];
const pageSlugs = new Set(pages.map((page) => page.slug));
const searchableContent = allContent.filter(
  (item) =>
    !(
      posts.includes(item) &&
      item.slug.startsWith("task-group-") &&
      pageSlugs.has(item.slug)
    )
);
const searchIndex = searchableContent.map((item) => ({
  title: titleFor(item),
  url: pagePath(item),
  type: pages.includes(item) ? "Page" : "News",
  description: descriptionFor(item),
  content: stripHtml(item.content.rendered).slice(0, 4000),
}));

await mkdir(join(ROOT, "assets"), { recursive: true });
await cp(SOURCE_UPLOADS, join(ROOT, "assets/uploads"), {
  recursive: true,
  force: true,
});

await writeRoute(
  "/",
  layout({
    title: "Home",
    description:
      "The International Society for Smart Construction and Production advances innovation, collaboration and knowledge across the global built environment.",
    path: "/",
    body: homeBody(),
    bodyClass: "home",
  })
);

for (const item of pages) {
  const path = pagePath(item);
  await writeRoute(
    path,
    layout({
      title: titleFor(item),
      description: descriptionFor(item),
      path,
      body: articleBody(item, "page"),
      bodyClass: `page page-${item.slug}`,
    })
  );

  if (
    item.slug.startsWith("task-group-") &&
    !path.startsWith("/task-group-")
  ) {
    await writeRoute(`/${item.slug}/`, redirectLayout(`/${item.slug}/`, path));
  }
}

for (const item of posts) {
  const path = pagePath(item);
  const mediaItem = mediaById.get(item.featured_media);
  await writeRoute(
    path,
    layout({
      title: titleFor(item),
      description: descriptionFor(item),
      path,
      body: articleBody(item, "post"),
      bodyClass: `post post-${item.slug}`,
      image: mediaItem
        ? localizeUrl(mediaItem.source_url)
        : "/assets/uploads/2024/07/construction01-1536x976.jpg",
    })
  );
}

await writeRoute(
  "/news/",
  layout({
    title: "News & Perspectives",
    description:
      "Announcements, leadership profiles, conference updates and messages from the SCP community.",
    path: "/news/",
    body: newsBody(),
    bodyClass: "news-archive",
  })
);

await writeRoute(
  "/search/",
  layout({
    title: "Search",
    description: "Search the SCP website.",
    path: "/search/",
    body: searchBody(),
    bodyClass: "search",
  })
);

const notFoundBody = `
  <main id="main" class="not-found">
    <div class="shell">
      <p class="eyebrow">404</p>
      <h1>We could not find that page.</h1>
      <p>The page may have moved during the transition from WordPress to the new static website.</p>
      <a class="button" href="/">Return home</a>
      <a class="text-link" href="/search/">Search the website &rarr;</a>
    </div>
  </main>`;
await writeFile(
  join(ROOT, "404.html"),
  layout({
    title: "Page not found",
    description: "The requested SCP page could not be found.",
    path: "/404.html",
    body: notFoundBody,
  })
);

await writeFile(
  join(ROOT, "search-index.json"),
  JSON.stringify(searchIndex, null, 2)
);

const routes = [
  "/",
  "/news/",
  "/search/",
  ...allContent.map(pagePath),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...new Set(routes)]
  .map((route) => `  <url><loc>${SITE_URL}${route}</loc></url>`)
  .join("\n")}
</urlset>`;
await writeFile(join(ROOT, "sitemap.xml"), sitemap);
await writeFile(
  join(ROOT, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`
);
await writeFile(join(ROOT, ".nojekyll"), "");

console.log(
  `Generated ${pages.length} pages, ${posts.length} posts, news, search, 404, and ${searchIndex.length} search records.`
);
