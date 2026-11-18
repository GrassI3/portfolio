export const CONFIG = {
  github: "https://github.com/GrassI3",
  email: "jaiworkmail13@gmail.com",
  linkedin: "", // e.g. "https://www.linkedin.com/in/your-handle" (shown only when set)
  resume: "",   // e.g. "resume.pdf" after dropping the PDF into /public
};

/*
  Each record:
  - tracks: [text, metric] pairs shown as "Side A"
  - art: sleeve design (type | kanban | hook | graph | barcode | wave | ascii | sun | flag)
  - music: { style, name }. style picks an original generated piece (see src/audio/compose.js).
    To use a real audio file instead, add  src: "music/your-file.mp3"  (placed in /public/music).
*/
export const RECORDS = [
  {
    id: "self", cat: "JGD-001", kind: "About", title: "Self-Titled", artist: "Jai Gauns Dessai — debut, still recording",
    art: "type", bg: "#efe2c6", fg: "#1d1814", accent: "#e0532f", label: "#e0532f", paper: "#e0532f",
    music: { style: "lofi", name: "Quepem Afternoons — lo-fi" },
    blurb: "Computer Engineering at Goa College of Engineering, graduating June 2027. I like software that runs close to the metal and software that thinks: native Rust clients, on-device ML, security tooling. On weekends I break things at CTFs.",
    tracks: [
      ["Goa College of Engineering, Computer Engineering", "9.09 CGPA"],
      ["Graduating", "June 2027"],
      ["Based in", "Quepem, Goa"],
      ["Code in", "C · C++ · Rust · Python · JS · Java · SQL · x86 · Bash"],
      ["Speak", "English · Hindi · Konkani"],
    ],
    stackLabel: "Toolbox",
    stack: ["React", "React Native", "Next.js", "Angular", "Node.js", "Express", "FastAPI", "Flask", "PyTorch", "TensorFlow", "scikit-learn", "Docker", "Linux", "AWS", "GCP", "Ghidra", "IDA", "GDB", "Wireshark"],
    links: [["GitHub", CONFIG.github], ["Email me", "mailto:" + CONFIG.email]],
  },
  {
    id: "mogra", cat: "MGR-026", kind: "Experience · Software Developer Intern", title: "mograCRM Kanban", artist: "Mograsys Technologies Ltd. — Margao, Goa · Aug–Sep 2026",
    art: "kanban", bg: "#1f3a33", fg: "#e8dcc4", accent: "#f0a43a", label: "#f0a43a", paper: "#c97a12",
    music: { style: "synthwave", name: "Six Workers — synthwave" },
    blurb: "Turned a legacy MantisBT CRM into a fast native Windows client: interactive Kanban boards and analytics dashboards for the dev team, with auto-updates from AWS. Statically linked and zero-dependency, so it just runs.",
    tracks: [
      ["Rust desktop client: zero-dependency, statically linked", "~36k LOC"],
      ["Codebase split into", "43 modules"],
      ["Concurrent page-fetch pipeline, 6 workers + corpus cache", "16 min → 40 s"],
      ["Live tickets ingested", "~19,800"],
      ["Background tray agent + registry hooks + native toasts", "always on"],
      ["Compile-time read/write isolation, GitHub Actions CI", "480+ tests"],
    ],
    stack: ["Rust", "Tauri", "WebView2", "Axum", "WebAssembly", "HTMX", "Askama", "AWS", "Windows SDK", "MSSQL"],
    links: [],
  },
  {
    id: "phish", cat: "PHM-404", kind: "Project · Android + ML", title: "Phisherman", artist: "On-device phishing detection — Hacksploit 2026, NIT Goa",
    art: "hook", bg: "#0f2a44", fg: "#dff3ff", accent: "#46d6c4", label: "#46d6c4", paper: "#1aa392",
    music: { style: "ambient", name: "Low Tide — ambient" },
    blurb: "Registers as your default link handler and shows a warning before a dangerous page opens. Links, SMS and call transcripts are scored by models running fully on the phone, so nothing leaves the device.",
    tracks: [
      ["Random Forest on 19 URL features → ONNX, on-device", "0.7% FPR"],
      ["Link-model precision, 65k held-out URLs", "96%"],
      ["SMS engine precision / recall", "96.5 / 98.7"],
      ["Gemma 3 270M, LoRA fine-tuned: label + reason, offline", "98.5%"],
      ["Training corpus with domain-disjoint splits", "~360k URLs"],
      ["Bloom-filter blocklist + Kotlin/Python parity tests", "offline"],
    ],
    stack: ["Kotlin", "Jetpack Compose", "Python", "scikit-learn", "ONNX Runtime", "PyTorch", "LoRA", "Gemma 3"],
    links: [["Repo is private — demo on request", null]],
  },
  {
    id: "spectre", cat: "SPC-001", kind: "Project · Threat Intel · 1st Place", title: "Spectre", artist: "Darknet intelligence & attribution engine — Secure AI Hackathon, BITS Goa × IITM",
    art: "graph", bg: "#0d0d10", fg: "#e9e6ff", accent: "#9b7bff", label: "#9b7bff", paper: "#7a57f0",
    music: { style: "dark", name: "Louvain — dark minimal" },
    blurb: "Rebuilds fragmented adversary identities across darknet marketplaces. Wallet reuse, writing style and graph structure are fused into one explainable attribution score, and an AI copilot lets an investigator ask questions in plain English.",
    tracks: [
      ["Crypto artifacts + stylometry + Louvain communities", "multi-signal"],
      ["Forensic telemetry lake, SHA-256 chain of custody", "DuckDB"],
      ["Real-time 3D threat graph", "Three.js"],
      ["ReAct investigator copilot, natural-language queries", "Gemini 2.5"],
      ["Threat-pattern families detected", "7"],
    ],
    stack: ["Next.js", "FastAPI", "DuckDB", "Three.js", "NetworkX", "Gemini"],
    links: [["GitHub", "https://github.com/GrassI3/Spectre"]],
  },
  {
    id: "kasse", cat: "KSE-025", kind: "Project · Mobile + Payments", title: "Kasse", artist: "Self-checkout application",
    art: "barcode", bg: "#f2c94c", fg: "#1a1a1a", accent: "#1a1a1a", label: "#1a1a1a", labelInk: "#f2c94c", paper: "#c48f00",
    music: { style: "bossa", name: "Aisle Seven — bossa nova" },
    blurb: "Scan, pay, walk out. A self-checkout app with a Stripe payment flow behind an Express backend and real-time inventory sync in Firebase.",
    tracks: [
      ["Customer checkout flow built for speed", "React Native"],
      ["Stripe payments via Express, automated confirmation", "real-time"],
      ["NoSQL store: inventory, profiles, order history", "Firebase"],
      ["Product media", "Cloudinary"],
    ],
    stack: ["React Native", "Expo", "Express.js", "Stripe API", "Firebase", "Cloudinary"],
    links: [["GitHub", "https://github.com/GrassI3/Kasse"]],
  },
  {
    id: "vikas", cat: "VKS-108", kind: "Project · Voice AI · Social Impact", title: "Vikas.ai", artist: "A health & civic assistant you reach with a plain phone call",
    art: "wave", bg: "#e8573a", fg: "#fff3e6", accent: "#2b1a12", label: "#fff3e6", labelInk: "#e8573a", paper: "#e8573a",
    music: { style: "raag", name: "Evening Call — raag Yaman sketch" },
    blurb: "Dial a number from any phone and ask. You don't need an app, the internet or the ability to read. Answers are grounded in PubMed, cited, and explained step by step in the caller's language.",
    tracks: [
      ["Works on feature phones & landlines", "PSTN"],
      ["Indian languages, auto-detected", "8+"],
      ["LangGraph: triage → RAG → reasoning → citation", "4 stages"],
      ["Evidence from ChromaDB + live PubMed", "cited"],
      ["Emergency detection, dosage blocking, helplines", "guardrails"],
      ["Answer arrives over SMS if the call drops", "fallback"],
    ],
    stack: ["FastAPI", "LangGraph", "Llama 3.1 (Groq)", "ChromaDB", "Deepgram", "ElevenLabs", "Vapi", "Twilio"],
    links: [["GitHub", "https://github.com/GrassI3/Vikas.ai"]],
  },
  {
    id: "itt", cat: "ITT-256", kind: "Project · CLI", title: "imageToTerm", artist: "Images, rendered as ASCII art in your terminal",
    art: "ascii", bg: "#0e140e", fg: "#7dff8a", accent: "#7dff8a", label: "#7dff8a", paper: "#1f9d4c",
    music: { style: "chiptune", name: "Ramp .:-=+*#%@ — chiptune" },
    blurb: "A small, fast C++ command-line tool that turns PNGs and JPEGs into ASCII art, with ANSI colour and automatic scaling to your terminal size.",
    tracks: [
      ["ANSI colour output", "colour"],
      ["Auto-scales to terminal dimensions", "fit"],
      ["PNG and JPEG input", "2 formats"],
    ],
    stack: ["C++", "ANSI escape codes", "CLI"],
    links: [["GitHub", "https://github.com/GrassI3/imageToTerm"]],
  },
  {
    id: "hits", cat: "GH-1ST", kind: "Compilation · Awards", title: "Greatest Hits", artist: "Hackathons & CTFs, 2024–2026",
    art: "sun", bg: "#151210", fg: "#f6dc95", accent: "#d6a54f", label: "#d6a54f", paper: "#b07a22",
    music: { style: "swing", name: "First Place Strut — swing" },
    blurb: "Podiums from hackathons and capture-the-flag competitions across India, plus one global nomination.",
    tracks: [
      ["Secure AI Hackathon — BITS Goa × IITM", "1st"],
      ["Mindspark 2k25 — PCCE Techyon", "1st"],
      ["GhostGrid CTF — TechUrja, AITD", "1st"],
      ["Cyber Siege CTF — PCCE Techyon", "2nd"],
      ["NASA Space Apps Challenge — Global Nominee", "Top 600"],
      ["Goa Police Hackathon · IIT Dhanbad Hackathon · Hacksploit (NIT Goa)", "Finalist"],
    ],
    stackLabel: "Disciplines",
    stack: ["Web Exploitation", "Reverse Engineering", "OSINT", "Digital Forensics", "Cryptography", "Applied ML"],
    links: [],
  },
  {
    id: "live", cat: "LIVE-26", kind: "Live recording · Leadership", title: "Live at Technix", artist: "Running the show instead of playing it",
    art: "flag", bg: "#b8232f", fg: "#ffe9d6", accent: "#ffe9d6", label: "#120f0d", labelInk: "#ffe9d6", paper: "#b8232f",
    music: { style: "blues", name: "Capture the Flag Shuffle — blues" },
    blurb: "Designed the challenges other people sweat over, and kept a 50-person competition fair.",
    tracks: [
      ["Technix CTF 2026 — Coordinator: web exploitation, OSINT & RE challenges", "10+"],
      ["NUM1X, MATIKS × GEC Collegiate League — point of contact", "50+ players"],
      ["Anti-cheating protocols; resolved shadow-ban errors to restore fair access", "fair play"],
    ],
    stackLabel: "On stage",
    stack: ["Challenge design", "Web Exploitation", "OSINT", "Reverse Engineering", "Event ops"],
    links: [],
  },
];

if (CONFIG.linkedin) RECORDS[0].links.push(["LinkedIn", CONFIG.linkedin]);
if (CONFIG.resume) RECORDS[0].links.push(["Resume", CONFIG.resume]);

/* ---------- editorial content around the records ---------- */

// shown in the discography list
export const FORMATS = {
  self: "Debut", mogra: "LP · 2026", phish: "LP · 2026", spectre: "LP · 2026", kasse: "EP · 2025",
  vikas: "EP · 2026", itt: "Single", hits: "Compilation", live: "Live",
};

// album-back credits = skills
export const CREDITS = [
  ["Written, produced & debugged by", "Jai Gauns Dessai"],
  ["Recorded at", "Goa College of Engineering, 2023–2027 · CGPA 9.09"],
  ["Languages", "C, C++, Rust, Python, JavaScript, Java, SQL, x86 assembly, Bash"],
  ["Frameworks", "React, React Native, Next.js, Angular, Node.js, Express, FastAPI, Flask"],
  ["Machine learning", "PyTorch, TensorFlow, Keras, scikit-learn, ONNX"],
  ["Security", "Reverse engineering, digital forensics, web exploitation, OSINT, cryptography"],
  ["Tools", "Linux, Docker, Git, Ghidra, IDA, GDB, Wireshark"],
  ["Cloud", "AWS, GCP"],
  ["Spoken", "English, Hindi, Konkani · Marathi (listening only)"],
];

// awards as chart positions
export const CHARTS = [
  ["01", "Secure AI Hackathon", "BITS Goa × IIT Madras"],
  ["01", "Mindspark 2k25", "PCCE Techyon"],
  ["01", "GhostGrid CTF", "TechUrja, AITD"],
  ["02", "Cyber Siege CTF", "PCCE Techyon"],
  ["Top 600", "NASA Space Apps Challenge", "Global nominee"],
  ["Final", "Goa Police Hackathon · IIT Dhanbad · Hacksploit", "Finalist, three times"],
];
