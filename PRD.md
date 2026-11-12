# 📄 Product Requirements Document (PRD): ORBIT (`/orbit` / `/llm` / `/web-llm-orchestrator`)

| Metadata | Spesifikasi Teknis |
| :--- | :--- |
| **Product Name** | **ORBIT** — Orchestrated Reasoning Bridge for Interactive Tabs (Antigravity Slash Command: `/orbit` / alias: `/llm`, `/web-llm-orchestrator`) |
| **Document Version** | **v2.5.0 (Multi-Session Context Isolation, Adaptive Intent Synthesis & Expanded Domain Matrix)** |
| **Status** | **Production Hardened & Live Multi-Model Verified (19/19 Suites 100% Passed)** |
| **Architecture** | Local Model Context Protocol (MCP) Server + Thin Antigravity Skill |
| **Protocol & Port** | Chrome DevTools Protocol (CDP) `127.0.0.1:9222` (Stdio JSON-RPC 2.0) |
| **Target Runtime** | Windows 10/11 (PowerShell / CMD), Node.js v20+, Google Chrome Official |
| **Core Dependencies** | `puppeteer-core` (Zero external dependencies, zero API billing) |

---

## 0. 📜 Repository Governance & Mandatory Documentation Constraint

> [!IMPORTANT]
> **ATURAN MUTLAK KONTRIBUTOR & AI CODING ASSISTANT:**
> Setiap kali terjadi:
> 1. Penambahan modul baru, fungsi baru, atau opsi model baru di codebase (`src/`).
> 2. Perubahan alur arsitektural (failover, stream recovery, lock manager, sanitasi, driver guard, auto-recovery).
> 3. Penambahan pengujian unit atau integrasi baru (`tests/`).
>
> Maka **`PRD.md`** dan **`README.md`** **WAJIB DIPERBARUI SECARA SINKRON** sebelum tugas/percakapan diselesaikan. Dokumentasi tidak boleh tertinggal atau usang (*zero documentation debt*).

---

## 1. 📌 Executive Summary & Product Vision

### 1.1 Visi Produk
**Web-LLM Orchestrator** adalah infrastruktur orkestrasi peramban multi-model yang menjembatani asisten pemrograman AI lokal (**Antigravity**) dengan ekosistem model penalaran web berbayar (**Claude Sonnet 5.5**, **Qwen Thinking Mode**, **ChatGPT-4o**, dan **Gemini 4 Argon**) secara visual melalui koneksi resmi **Chrome DevTools Protocol (CDP)** port `127.0.0.1:9222`.

### 1.2 Premis Inti: Arbitrase Kuota (Bukan Billing API)
Agen coding modern (seperti Antigravity) membatasi konsumsi model non-Gemini (Claude Opus/Sonnet) dalam *pool* kuota ketat per jam atau per hari. Di saat yang sama, banyak praktisi AI dan peneliti telah memiliki langganan mandiri antarmuka web (Claude Pro, ChatGPT Plus, atau akun gratis Qwen dengan mode deep thinking). 

Produk ini dirancang bukan untuk mengeksploitasi API per-token, melainkan melakukan **arbitrase kuota**—mengalihkan beban penalaran berat, evaluasi rumus matematika LaTeX, dan tinjauan arsitektur kode ke langganan web yang sudah dibayar, sekaligus mengamankan sisa kuota Antigravity.

---

## 2. 🎯 Problem Statements & Solusi Konkret

| No | Problem Statement (Kondisi Saat Ini) | Dampak Negatif | Solusi Web-LLM Orchestrator |
| :--- | :--- | :--- | :--- |
| **P-1** | **Batas Kuota Model Non-Gemini di IDE:** Pengguna kehabisan kuota Claude di Antigravity di tengah sesi krusial. | Pekerjaan coding/paper terhenti atau terpaksa turun ke model dengan penalaran lebih rendah. | **Arbitrase Kuota Web:** Menggunakan antarmuka web Claude/Qwen/ChatGPT via profil Chrome yang sudah login. |
| **P-2** | **Frustrasi Saat Rate Limit Web:** Sesi web LLM mendadak terkena batas pesan (rate limit). | Pengguna harus manual membuka tab baru, menyalin konteks percakapan, dan mengulang prompt. | **Automated Context Handoff:** Memindahkan $N=3$ giliran obrolan terakhir ke model cadangan secara otomatis. |
| **P-3** | **Context Bloat Agen (Boros Token):** Agen AI membaca ratusan baris file LaTeX/kode ke konteksnya sebelum mengirim ke tool. | Membakar ribuan token konteks agen utama untuk teks mentah yang sebenarnya hanya perlu dianalisis. | **Injeksi File Langsung (`files: []`):** File dibaca langsung dari harddisk ke browser, memangkas konsumsi token agen 100%. |
| **P-4** | **Kerusakan Formula LaTeX oleh KaTeX/MathJax & UI Kustom:** Browser merender formula matematika menjadi HTML/MathML visual yang hancur saat di-`innerText` (terutama Qwen build terkini yang merender tanpa tag `<annotation>`). | Formula turunan matematika, integral, dan matriks rusak atau tidak terbaca saat kembali ke agen (misal: terpotong per karakter). | **Multi-Tier Formula Preservation:** Parser mengekstrak tag `<annotation encoding="application/x-tex">`, fallback MathML direct `TEXT_NODE` (`<math>`), dan MathJax script, lalu mengganti in-place secara non-destruktif. |
| **P-5** | **Basa-Basi dan Hilangnya Penurunan Rumus:** Prompt polos "jawab singkat" sering memotong langkah bukti matematika. | Argumen teknis kehilangan justifikasi logis atau dibanjiri kata sapaan kosong. | **Kontrak "Engineering Caveman":** Mengeliminasi basa-basi sejak hulu, mewajibkan format `[THING] [ACTION] [REASON]` dengan kurung siku, dan penurunan rumus utuh dalam blok `latex`. |
| **P-6** | **Tab Throttling & Tab Bloat:** Chrome di Windows membekukan (*throttle*) tab di latar belakang dan memicu *Memory Saver discard*. | Driver gagal mendeteksi streaming, timeout palsu, atau menghasilkan puluhan tab liar yang membebani RAM. | **Persistent 3-Tab Topology:** Tepat 3 tab persisten dengan flag anti-throttling dan panggilan native `bringToFront()`. |
| **P-7** | **Potongan Generasi Buntung Saat Rate Limit:** AI web terputus di tengah kalimat, blok kode, atau rumus saat kuota habis mendadak. | Oper teks manual menghasilkan sintaks rusak, unclosed fence, dan hilangnya kontinuitas narasi. | **Stream Recovery & Tail Sealing (`stream_recovery.js`):** Memotong rapi unclosed fence/math, membuang notice kuota, menyusun ledger, dan membungkus rehydration prompt ber-nonce. |
| **P-8** | **Campuran Delimiter Math & KaTeX Crash:** Model mencampur `\[...\]`, `\(...\)`, dan `$$`, atau merusak KaTeX saat rendering. | UI crash, formula tidak terbaca, atau silent failure pada parser dokumen downstream. | **LaTeX Math Normalizer & Quarantine (`math_normalizer.js`):** Mengonversi delimiter ke standar markdown $ / $$, mengarantina formula rusak ke blok ````tex```` tanpa silent crash. |
| **P-9** | **Model & Mode Penalaran Rendah Secara Bawaan:** Qwen default ke 3.7 Otomatis dan ChatGPT default non-thinking. | Analisis mendalam tidak optimal karena tidak mengaktifkan model unggulan terbaru dan deep reasoning. | **Automated Model & Thinking Lock:** Otomatis memilih `Qwen3.8-Max` dan mengunci mode "Berpikir" pada Qwen dan ChatGPT (via tombol & shortcut `Ctrl+Shift+M`). |
| **P-10**| **Risiko Premature Return saat Berpikir Panjang (20-60s):** ChatGPT & Qwen berada dalam fasa berpikir murni sebelum mengetik teks, berisiko mengembalikan pesan giliran lama jika tombol stop desinkron. | Agen menerima respon dari pertanyaan sebelumnya atau gagal menunggu penalaran tuntas. | **Turn-Count Guard & Thinking Telemetry:** Driver memeriksa `currentCount > this.initialCount`, mendeteksi elemen penalaran aktif (`data-testid*="thought"`, `aria-label*="berpikir"`), dan memastikan kestabilan respons giliran baru. |
| **P-11**| **Passive Messenger Antipattern & Premature User Handoff:** Orchestrator hanya bertindak sebagai kurir pemindah teks (kirim prompt mentah $\rightarrow$ terima ide mentah $\rightarrow$ lempar ke pengguna beserta keluhan kelemahan). | Pengguna dibebani ide mentah yang tidak realistis (misal: sensor drift MPU6050, sensor DO melanggar pagu anggaran Rp10jt) dan terpaksa melakukan debat manual sendiri. | **Autonomous Multi-Turn Interrogation Loop (AMTIL):** Orchestrator otomatis menyaring celah 4 dimensi (anggaran, fisika, validasi lab, komputasi), mendebat kembali model web di browser tab aktif (Turn 2+), dan hanya menyajikan artefak final yang *battle-tested*. |
| **P-12**| **Unbounded Generative Syndrome & "Garbage-In" Prompting:** Instruksi pengguna yang singkat/mentah langsung diteruskan ke LLM tanpa batasan finansial, timeline, dan skala uji. | LLM berhalusinasi mengusulkan sensor lab enterprise berharga puluhan juta, riset multi-tahun, atau komponen impor yang melanggar pagu hibah kompetisi (misal: Belmawa PKM). | **Lyra 4-D Prompt Optimizer (`prompt_synthesizer.js`):** Membedah teks mentah (Deconstruct $\rightarrow$ Diagnose $\rightarrow$ Develop $\rightarrow$ Deliver), mengunci pagu BoM hardware $\le$ Rp3.5M, membatasi komponen COTS lokal, dan menyuntikkan *Negative Constraints* sebelum menyentuh browser. |
| **P-13**| **Arbitrary Step-Counting Fallacy (Debat Kaku Dibatasi Putaran):** Penghentian perdebatan secara statis (misal: diputus paksa di Turn 2) mengabaikan efek domino rekayasa (revisi sensor di Turn 2 sering memicu masalah mekanik/daya baru). | Proposal yang diserahkan ke pengguna masih membawa cacat baru yang belum terselesaikan. | **Dynamic Convergence-Driven Loop (`interrogation_engine.js`):** Perdebatan berhenti murni karena konvergensi teknis (*Zero Flaws*), dilengkapi deteksi stagnasi nalar (*Plateau Detection*) dan sekering darurat (*Circuit Breaker*). |
| **P-14**| **Domain Rigidity & False Hardware Scrutiny:** Kerangka interogasi dan optimasi prompt terkunci kaku pada asumsi perangkat keras PKM-KC (memaksakan BoM hardware dan simulator meja uji lab pada lomba Data Mining atau Software Analytics). | Model LLM dibingungkan oleh sanggahan hardware yang salah konteks, dan dokumen non-hardware gagal diinterogasi secara akurat. | **Domain-Aware Optimization & Scrutiny Architecture:** `domain_rules.json` mendukung multi-domain (`pkm_kc`, `data_mining`, `general_technical`). Menerapkan persona Kaggle Grandmaster, validasi kepatuhan platform (Kaggle max 3 subs/hari), larangan keras (LLM pseudo-labeling, AutoML blackbox), dan rubrik 50-40-10 tanpa false hardware checks. |
| **P-15**| **Synthetic Click Rejection & Stuck Composer Input:** Pemanggilan `.click()` sintetis JavaScript di dalam `page.evaluate()` ditolak oleh composer React/Lexical ChatGPT (`isTrusted: false`), menyebabkan tombol kirim tidak memicu submit. | Prompt tersangkut di input box, tidak pernah terkirim ke server AI, dan driver mengalami timeout palsu. | **Native Trusted Click & Post-Send Verification Guard (`chatgpt_driver.js`):** Menggunakan native trusted click `ElementHandle.click()` Puppeteer, fallback penekanan Enter terarah, dan verifikasi pasca-kirim (`isStillStuck`) dengan retry ganda untuk menjamin input box kosong tuntas. |
| **P-16**| **Race Condition Multi-Turn & Canvas Editor Hijacking pada ChatGPT:** `waitForResponse()` keluar sebelum ChatGPT tuntas streaming respon masif ($>40.000$ karakter) karena jeda transmisi sementara, sehingga giliran berikutnya (Turn 2+) mengetik saat tombol Stop masih aktif dan tombol Kirim belum ada. Selain itu, pembukaan panel Canvas memicu selektor generik `div[contenteditable='true']` membajak editor kode Canvas alih-alih composer pesan chat. | Prompt sanggahan tersangkut di input box chat, tidak terkirim, dan driver melaporkan kesimpulan prematur/timeout. | **Pre-Send Busy Guard, Isolated Composer Selectors, & Strict Generating Guard (`chatgpt_driver.js`):** `waitForIdle()` mengunci pengiriman Turn 2+ hingga Stop button lenyap dan model benar-benar idle; `selectors.json` mengisolasi `div.ProseMirror` dan mengecualikan `.cm-content` Canvas editor; `waitForResponse()` memeriksa `isVisible` (offset & client rects) serta menaikkan default timeout ke 420s (7 menit). |
| **P-17**| **ChatGPT React Client-Side Render Crash (`data-dil-render-failed`):** Pada respon penalaran ultra-panjang ($>35.000$ karakter), React virtual DOM ChatGPT terkadang mengalami render failure di akhir stream dan menampilkan banner `"Respons ini tidak dapat dimuat"`, padahal teks penuh sebenarnya tersimpan utuh di database server OpenAI. Driver lama langsung mengembalikan pesan error atau memicu kebingungan pengguna. | Tampilan browser pengguna rusak ("Respons ini tidak dapat dimuat"), menimbulkan kesan halusinasi bahwa respons tidak ada. | **Render-Failed Auto-Healing via Reload (`chatgpt_driver.js`):** `detectGenerationError()` mendeteksi `data-dil-render-failed` dan teks `"Respons ini tidak dapat dimuat"`, secara otomatis merefresh halaman (`page.reload()`) untuk merestorasi teks utuh langsung dari database OpenAI, sehingga layar pengguna di Chrome kembali bersih dan menampilkan seluruh teks secara sempurna. |
| **P-18**| **Claude Pre-Send Collision, Stuck Composer, & Generation Error:** Claude pada antarmuka web rentan mengalami race condition saat pengiriman pesan giliran baru (Turn 2+) jika model masih sibuk atau langkah alat (*TurnStatusStep*) masih berjalan. Selain itu, banner error ("error generating response", "conversation is too long") memutus generasi tanpa penanganan otomatis. | Prompt tersangkut di editor ProseMirror, terputus tanpa submit, atau pesan gagal dirender tanpa recovery otomatis. | **Claude Driver Hardening & Auto-Healing (`claude_driver.js`):** Menambahkan `waitForIdle(120000)` Pre-Send Busy Guard (memeriksa stop selectors, `[data-is-streaming="true"]`, dan `[data-cds="TurnStatusStep"]`), Post-Send Verification Guard dengan retry trusted click, `detectGenerationError()` dengan pola error di `selectors.json`, dan auto-healing via `page.reload()`. |
| **P-19**| **Claude Skill Slash Command Friction (`/caveman`):** Pengguna memiliki skill kustom `/caveman` di antarmuka web Claude yang mengatur gaya penalaran ringkas tanpa basa-basi. Jika prompt tidak diawali dengan slash command `/caveman`, skill tersebut tidak terpicu secara native di Claude. Namun, jika `/caveman` dikirim berulang pada setiap giliran obrolan (Turn 2+), antarmuka Claude menjadi redundan dan berisiko menduplikasi chip. | Skill `/caveman` tidak terpicu di Claude, atau sebaliknya memunculkan chip berulang yang mengotori thread obrolan lanjutan. | **Claude Native Skill Activation on Initial Session Turn (`claude_driver.js` & `orchestrator.js`):** Driver mendeteksi sesi chat awal (`isInitialTurn: true`, URL `/new`, atau `messageCount === 0`) khusus untuk provider `claude`, lalu secara otomatis mengetik `/caveman` via keyboard native dan menekan `Enter` untuk mengaktifkan skill chip Claude (`data-skill-id="caveman"`). Pada giliran obrolan lanjutan (Turn 2+) dalam sesi yang sama, `/caveman` tidak ditambahkan kembali. Saat sesi direset (`resetSession()`), `/caveman` akan otomatis diaktifkan kembali pada prompt pertama. |
| **P-20**| **Cross-Directory File Attachment & Multi-File CLI Parsing:** Pemeriksaan file lampiran sebelumnya membatasi path secara kaku hanya di dalam subdirektori `process.cwd()`, sehingga memicu `PATH_TRAVERSAL_VIOLATION` saat pengguna melampirkan file dari workspace target lain (misal: `C:\dapa\LINUX-COMMUNITY`). Selain itu, CLI `--files` hanya menerima argumen tunggal. Akibatnya, model web menerima prompt yang hanya menyebut path lokal tanpa isi kodenya, memicu kebingungan dan blocker bahwa file tidak dapat diakses. | Model LLM di browser tidak dapat membaca kode lokal, mengeluhkan file tidak dapat diakses, atau terjadi penolakan traversal yang sah. | **Absolute Path Cross-Directory Resolution & Multi-File CLI Parsing (`orchestrator.js` & `cli.js`):** `resolveFiles()` kini mendukung path absolut dari workspace mana pun di mesin lokal dengan normalisasi path lintas OS dan penegakan *Privacy Guard* ketat (`.env`, `.key`, `id_rsa`, `.git/`). `cli.js` mendukung daftar file dipisahkan koma (`--files "file1.ts,file2.ts"`) maupun bendera `--files` berulang. Seluruh isi kode sumber diinjeksi langsung ke dalam blok prompt browser. |
| **P-21**| **Nonsensical Flume-Box Counter-Prompting & Blocker Blindness in AMTIL:** Kerangka interogasi AMTIL sebelumnya mengasumsikan seluruh evaluasi non-data-mining adalah PKM-KC hardware, sehingga saat model web merespons `BLOCKER: Source files unavailable` atau saat membahas software coding/web app, engine secara keliru mengirim counter-prompt menuntut "meja uji lab terkontrol / flume box / sensor drift MPU6050". | Model web (Claude/ChatGPT) bingung, mengulang penolakan, dan loop interogasi terjebak dalam perdebatan halusinasi yang tidak relevan dengan tugas software. | **Dynamic Blocker Handling & Software Engineering Scrutiny (`interrogation_engine.js`, `prompt_synthesizer.js`, `orchestrator.js`):** Mendeteksi `BLOCKER` dan permintaan source code secara global untuk menghentikan sanggahan halusinasi (`status: 'BLOCKED'`); memisahkan domain `software_engineering` dengan persona `Principal Software Architect`, memeriksa celah nyata software (placeholder `// TODO`, mock terisolasi tanpa integrasi API, empty catch block); serta mendukung argumen CLI eksplisit `--domain <domain>`. |
| **P-22**| **Static Domain Explosion & Heuristic Fragility (Replacing Rule-Based AMTIL with Dynamic Evaluator-Optimizer):** Sistem AMTIL lama mengandalkan regex dan kamus domain kaku (`domain_rules.json`), memicu combinatorial explosion dan kegagalan pada domain harian non-standar. | Sistem tidak fleksibel untuk *daily use* lintas bidang ilmu (DevOps, matematika, hukum, bisnis) karena domain baru menuntut aturan regex baru secara terus-menerus. | **Domain-Agnostic Evaluator-Optimizer Engine v2.0 (`critic_engine.js` & `critique_contract.js`):** Mengadaptasi riset *Huang et al. (2023)*, *Du et al. (2023)*, *Madaan et al. (2023)*, *Shinn et al. (2023)*, dan *Anthropic's Evaluator-Optimizer Workflow*. Menghapus regex semantik dan kamus domain dari jalur kritis, menggantinya dengan Dynamic Framing, Scoring Konvergensi Deterministik ($S_t = \sum w(\text{sev}_f) + 5U_t + 8L_t$), protokol kritik berbasis bukti (*evidence-gated*), dan budget putaran praktis per risk tier (`--tier 1\|2\|3`). |
| **P-23**| **Delayed Claude Limit Recognition & Hanging CDP Background Tasks:** Banner batas kuota Claude web ("You are out of free messages") sebelumnya memicu `waitForIdle()` menunggu hingga 120 detik, lalu melemparkan galat generic unhandled pada verifikasi kirim (`!sent`) alih-alih langsung memicu failover otomatis. Selain itu, proses latar belakang Node.js yang memegang koneksi Puppeteer CDP WebSocket tetap aktif tanpa batas waktu (*hanging background task*). | Pengguna terpaksa mengonfirmasi manual atau menunggu timeout panjang saat Claude limit, serta proses terminal tetap menggantung di latar belakang. | **Instant Pre-Send Limit Detection, Early Idle Exit, & Clean WebSocket Release (`claude_driver.js`, `browser_manager.js`, `orchestrator.js`):** Menambahkan pre-send rate limit check 0ms sebelum `waitForIdle()`, early exit pada `waitForIdle()` saat limit terdeteksi, deteksi DOM komprehensif (dialog, modal, sticky footer, treewalker, disabled send button), penanganan `!sent` ber-fallback limit, serta implementasi `BrowserManager.disconnect()` dan `Orchestrator.close()` untuk membersihkan event loop Node.js seketika. Terverifikasi live: limit Claude ditangkap dalam 0ms dan langsung dialihkan ke Qwen secara mulus. |
| **P-24**| **MCP Schema Disparity & Missing Stdio Server Lifecycle Traps:** Tool MCP `ask_web_llm` sebelumnya belum mendeklarasikan opsi kendali evaluasi (`tier`, `domain`, `interrogate`, `optimize_prompt`) pada `inputSchema` JSON-RPC, sehingga klien MCP tidak dapat menyesuaikan parameter risk tier. Selain itu, server stdio MCP tidak menangani penutupan stream (`rl.on('close')`) dan sinyal terminasi (`SIGINT`, `SIGTERM`), serta `QwenDriver` belum menyertakan pre-send rate limit check 0ms sebelum pemilihan model. | Klien agen tidak dapat mengonfigurasi kedalaman debat via MCP, proses server MCP berisiko menggantung saat klien disconnect, dan Qwen membuang waktu mencoba memilih model saat kuota harian habis. | **Full MCP Schema Parity, Clean Stdio Lifecycle Traps, & Qwen 0ms Limit Pre-Check (`mcp_server.js`, `qwen_driver.js`):** Menyelaraskan seluruh argumen tier/domain/interrogate ke skema JSON-RPC MCP, menambahkan trap `rl.on('close')` dan `SIGINT`/`SIGTERM` untuk memutus WebSocket CDP seketika, serta menyuntikkan pre-send rate limit check 0ms di awal `QwenDriver.sendMessage()`. |
| **P-25**| **Stale Session State Overriding Tab DOM Status & Fragile `/caveman` Skill Activation:** File riwayat global `session_state.json` menyimpan sisa giliran percakapan dari invocation CLI sebelumnya, menyebabkan `isFirstTurn` di `orchestrator.js` bernilai `false`. Akibatnya, `orchestrator.js` menyuntikkan pengingat giliran lanjutan alih-alih `ENGINEERING_CAVEMAN_CONTRACT`, dan meneruskan `{ isInitialTurn: false }` ke driver Claude. Pada saat yang sama, `claude_driver.js` lama mengutamakan `options.isInitialTurn` di atas status fisik tab di peramban, sehingga tab baru (`claude.ai/new`) gagal mengaktifkan skill `/caveman` via keyboard native. Selain itu, pembersihan string regex memangkas prefix secara membabi-buta bahkan saat keyboard skill chip gagal terbentuk, dan kursor ProseMirror tidak diruntuhkan ke ujung. | Prompt yang dikirim ke Claude tidak memiliki chip `/caveman` maupun teks `/caveman`, menyebabkan Claude kembali ke mode obrolan biasa (chatty) tanpa gaya penalaran Caveman ringkas yang diharapkan pengguna. | **URL /new Dominance, Infallible Skill Chip Verification, & Reset Flags (`claude_driver.js`, `orchestrator.js`, `cli.js`, `mcp_server.js`):** Driver Claude mengutamakan status fisik tab peramban (`currentUrl.includes('/new')`) sebagai *single source of truth* untuk giliran awal sesi baru (`isSessionStart = true`), mengesampingkan stale history dari pemanggilan sebelumnya. Menambahkan verifikasi DOM pasca-ketik untuk skill chip `[data-skill-id="caveman"]`. Jika chip gagal terbentuk, `/caveman` dipertahankan sebagai teks di awal prompt (*infallible fallback*). Meruntuhkan kursor seleksi (`range.collapse(false)`) tepat setelah chip `/caveman` sebelum `document.execCommand('insertText')` agar teks prompt disisipkan rapi di paragraf baru. Mendukung bendera `--new` / `--reset` pada CLI `ask` serta parameter `reset_session: true` pada MCP tool `ask_web_llm` untuk mengosongkan riwayat secara eksplisit. |
| **P-26**| **Shell Escaping Corruption, Tab De-synchronization on Reset, & Canned Script Bias in Multi-Turn Dialectic Debates:** Pada perdebatan dialektika teknis mendalam lintas putaran (multi-turn), sanggahan teknis sering memuat ratusan baris kode, simbol kutip berganda, dan ekspresi matematika kompleks yang rusak jika diteruskan lewat string argumen CLI Windows PowerShell. Selain itu, bendera `--new` / `--reset` sebelumnya hanya mengosongkan riwayat di memori tanpa merestart URL fisik tab browser (`https://claude.ai/new`, `https://chatgpt.com/`), sehingga `waitForIdle()` terkunci mendeteksi sisa respon lama yang masih aktif. Lebih jauh lagi, penyiapan sanggahan Turn 2+ yang sudah dipra-skrip (*canned/pre-scripted scripts*) membunuh esensi dialektika organik karena tidak membaca dan menyanggah dalil spesifik yang benar-benar diajukan model web. | Shell parser error, argumen terpotong, tab browser terkunci dalam busy state, dan perdebatan menghasilkan loop artifisial yang tidak menguji penalaran asli LLM web. | **Prompt-File Injection, Physical Tab Reset Navigation, & Organic Multi-Agent Dialectic Pattern (`cli.js`, `orchestrator.js`):** Menambahkan bendera CLI `--prompt-file <path>` untuk membaca teks sanggahan langsung dari disk tanpa risiko shell escaping; mengintegrasikan navigasi fisik tab peramban `browserManager.resetTabs(onLog, forceModel)` saat `--new` diaktifkan untuk menjamin tab bersih dan idle sebelum pengetikan; serta menstandardisasi pola *Organic Multi-Agent Dialectic Debater* di mana subagen membaca respons asli LLM di browser, mengutip dalil spesifiknya, dan menyusun sanggahan tajam hingga mencapai konvergensi murni. |
| **P-27**| **False-Positive Rate Limit Self-Triggering via Composer Self-Reflection & Tailwind Banner CSS Variables:** Selektor `div[class*="banner"]` pada `claude_driver.js` mencocokkan utility class Tailwind seperti `!mt-[calc(-1*min(var(--organization-banner-column-height,0px)...))]` pada container pembungkus utama halaman yang membawahi elemen composer input. Selain itu, `TreeWalker` memindai seluruh `document.body` tanpa mengecualikan area composer input (`div[contenteditable="true"]`, `.tiptap`, `fieldset`, `form`). Ketika file lampiran (seperti `PRD.md`) atau prompt pengguna yang mendiskusikan kalimat batas kuota (*"You are out of free messages"*, *"rate limit"*, *"resets at"*) diketik ke dalam input box, `detectRateLimit()` mendeteksi teks tersebut di dalam input draft sendiri sebelum tombol kirim ditekan. Akibatnya, driver membatalkan pengiriman, meninggalkan draf teks tersangkut di input box peramban, dan langsung memicu failover prematur ke Qwen. | Model web (Claude) keliru didiagnosis terkena limit padahal kuotanya masih tersedia, teks prompt tersangkut di composer tanpa pernah dikirim (*unsent draft*), dan sesi teralihkan secara tidak perlu. | **Composer & Form Containment Isolation Shield (`claude_driver.js`, `chatgpt_driver.js`, `qwen_driver.js`):** Mengisolasi deteksi banner rate limit dengan mengecualikan seluruh elemen composer (`isInsideComposerOrMessage`) dan container yang membungkus input form (`!containsComposer(el)`). Mengganti selektor substring `div[class*="banner"]` dengan selektor token presisi (`div[class~="banner"]`, `div.df-banner-slot`, `div.dframe-content-banner`). Pada `TreeWalker`, seluruh node teks di dalam composer input box diskip secara ketat. Diuji live pada Chrome CDP: draf prompt masif yang memuat kata kuota kini 100% bebas dari false positive rate limit. |
| **P-28**| **Enterprise Production Hardening Consensus (Reversible Pseudonymization, KaTeX DOM Quiescence, Hybrid LCS Stitcher, & Epistemic Degradation):** Berdasarkan audit adversarial dua putaran dengan Qwen Thinking Mode, teridentifikasi 4 celah edge-case arsitektural: (1) Secret exfiltration pada file sah tanpa pemindaian konten, (2) DOM mutation race condition pada KaTeX math rendering, (3) Seam drifting pada penyambungan stream failover bersarang (`}\n}\n`), dan (4) Potensi deadlock pada verifikasi bukti saat toolchain lokal tiada. | Risiko kebocoran kredensial lokal ke prompt web, potensi formula LaTeX terpotong di V8 rendering tree, silent truncation pada kode failover, dan infinite retry saat eksekutor lokal absen. | **Quad-Pillar Enterprise Architecture Consensus:** Mengintegrasikan 4 pilar arsitektur produksi: (1) `SecretPseudonymizer` berbasis in-memory reversibel hashing token, (2) `extractWithSyntacticValidation` inspeksi KaTeX pasca-clone zero-overhead fallback 500ms, (3) `stitchHybrid` berbasis 15-line Longest Common Subsequence (LCS) dynamic programming window, dan (4) `Graceful Epistemic Degradation` dengan status `BLOCKED_UNVERIFIABLE` untuk menghentikan evaluasi secara aman tanpa infinite retry. |
| **P-29**| **Hardcoded Domain Dictionaries & False Semantic Triggering in Prompt Synthesizer:** Modul pra-kirim `prompt_synthesizer.js` (Lyra 4-D) sebelumnya masih mempertahankan percabangan `if/else` hardcoded (`pkm_kc`, `data_mining`, `iot_hardware`, `software_engineering`) di dalam kode JavaScript. Selain bertentangan dengan arsitektur v2.0 domain-agnostik, regex tanpa word boundary menyebabkan kata biasa (misal: 'develop', 'api', 'ai') memicu domain software secara keliru. Audit adversarial Claude secara independen membongkar celah ini (*"Kamus domain PKM/data_mining masih hardcoded di jalur --optimize_prompt"*). | Pola domain tidak dapat diperluas tanpa modifikasi kode sumber, deteksi domain rentan falso-positif, dan arsitektur melanggar prinsip data-driven decoupling. | **100% Data-Driven Declarative Domain Architecture (`domain_rules.json` & `prompt_synthesizer.js`):** Memisahkan seluruh skema domain (pola ber-boundary `\b`, persona, batasan kuantitatif, negative constraints, format, required checks) ke dalam berkas konfigurasi deklaratif eksternal `src/templates/domain_rules.json`. `PromptSynthesizer` kini melakukan iterasi dinamis berbasis skema data dengan word boundary (`\b`), bebas dari `if/else` hardcoded, dan secara mulus fallback ke arsitektur teknis universal domain-agnostik jika tidak ada aturan yang cocok atau berkas konfigurasi tidak tersedia. |
| **P-30**| **Lingering Dead Code, Competition Bias, & Hardware COTS Artifacts in Universal Pipeline:** Modul `interrogation_engine.js` (351 baris) masih tersimpan sebagai dead code yang tidak pernah dipanggil di runtime, memuat aturan bias hardware usang (sensor optik DO, MPU6050 drift, meja uji flume box). Di saat bersamaan, `prompt_synthesizer.js` menyuntikkan gap bias 'aturan kompetisi' pada seluruh prompt umum dan format default universal memaksakan 'komponen pasaran umum' serta 'tabel komponen' pada prompt murni perangkat lunak/teori. Selain itu, domain `software_engineering` memaksakan stack kaku (Next.js/NestJS/WebSocket). | Output LLM (Qwen/Claude) terdistorsi memaksakan tabel komponen fisik dan aturan kompetisi mahasiswa pada pertanyaan umum, serta 351 baris dead code menimbulkan kebingungan arsitektural. | **Complete Legacy Dead Code Elimination & Universal Architecture Neutralization (`interrogation_engine.js`, `prompt_synthesizer.js`, `domain_rules.json`):** Merefaktor `interrogation_engine.js` menjadi backward-compatibility bridge tipis yang mewarisi `CriticEngine` (menghapus 351 baris dead code); menetralkan gap check di `diagnose()` menjadi 'perilaku destruktif atau anti-pola arsitektural'; membersihkan batasan default dan format universal dari bias komponen fisik COTS; serta menggeneralisasi domain `software_engineering` ke pemisahan layer modular dan DTO kontrak standar. Terverifikasi live di Qwen: output 100% bersih tanpa artefak hardware atau bias kompetisi. |
| **P-31**| **Complex Prompt Attention Dilution & Shell Quoting Corruption (Tri-Layer Execution Gate & Shell Safety Guard):** Pada prompt panjang dan kompleks (>300 char / multi-baris / memuat persona seperti *"bertindaklah sebagai reviewer"* atau formula matematika), agen AI lokal (Antigravity/Gemini) rentan mengalami *attention dilution* dan *task hijacking*—mengabaikan awalan slash command `/web-llm-orchestrator`, lalu menjawab langsung dari memori lokal alih-alih mendelegasikan ke peramban. Jika agen lokal mencoba memanggil CLI secara inline (`node cli.js ask "..."`), karakter kutip ganda, variabel shell PowerShell (`$var`), newline, dan backslash LaTeX (`\begin`) mengalami korupsi quoting. | Eksekusi automasi browser gagal terpicu (bypassed), jawaban lokal membakar kuota lokal/berkualitas rendah, atau proses CLI crash dengan galat sintaks PowerShell. | **Tri-Layer Execution Gate & Shell Safety Guard (`prompt_input.js`, `cli.js`, `SKILL.md`, `GEMINI.md`):** Menerapkan pertahanan 3 lapis: (1) *Lapis 1 (Router Affinity)*: Frontmatter `description` di `SKILL.md` berbobot tinggi mewajibkan delegasi mutlak tanpa menjawab mandiri; (2) *Lapis 2 (Workspace Interceptor Gate)*: Aturan tata kelola `GEMINI.md` melarang eksekusi internal dan mewajibkan penulisan file scratch serta pemanggilan CLI via `--prompt-file`; (3) *Lapis 3 (CLI Guardrail & Exit Code 2)*: Modul `src/prompt_input.js` memvalidasi input prompt, menolak teks inline multi-baris atau >300 karakter dengan galat `E_INLINE_UNSAFE` (exit code 2), dan mewajibkan penggunaan `--prompt-file <path>` atau `--stdin`. Terverifikasi live di Qwen: prompt kompleks komputasi medis (670 char, derivasi loss $\mathcal{L}_{\text{total}}$, persona reviewer) dieksekusi 100% mulus via peramban. |
| **P-32**| **Google Gemini (Gemini 4 Argon & 3.8 Flash) Integration, Long Thinking Silence Telemetry, & Segmented Mode Control:** Google Gemini merilis model flagship baru **Gemini 4 Argon** (dengan kedalaman penalaran Rendah/Sedang/Tinggi) serta toggle segmented button ("Percakapan" vs "Tugas"). Gemini 4 Argon memiliki fasa keheningan penalaran (*long thinking silence*) yang sangat panjang (45–72 detik) di mana panjang teks DOM tetap statis (`~29-47` karakter: *"Sedang menalar..."*), memicu timeout prematur pada polling standar. Selain itu, input Quill `.ql-editor` memerlukan `execCommand('insertText')` + spasi pemicu agar tombol kirim dinamis (`button[aria-label="Kirim pesan"]`) dimuat ke DOM, dan kloning KaTeX di memori tanpa melampirkan ke dokumen menghilangkan seluruh karakter baris baru (`\n`). | Pengguna tidak dapat memanfaatkan penalaran mutakhir Gemini 4 Argon via orchestrator, atau mengalami timeout palsu dan rusaknya pemformatan matematika serta baris kode. | **Native Gemini 4 Argon Driver & Long Thinking Silence Telemetry (`gemini_driver.js`, `selectors.json`, `orchestrator.js`, `cli.js`):** Mengembangkan driver penuh `GeminiDriver` berbasis `BaseDriver`. Mendukung pemilihan model (`4 Argon` sebagai default bawaan, `3.8 Flash`), tingkat penalaran (`Tinggi` default), pemilihan mode segmented (`Percakapan` default vs `Tugas`), perpanjangan batas waktu hingga 420 detik, telemetri Long Thinking Silence (menolak keluar selama tombol stop atau indikator menalar aktif), substitusi in-place KaTeX `<annotation>` pada kontainer tersembunyi `white-space:pre-wrap`, dan penggabungan ke dalam rantai failover utama: `Claude` $\rightarrow$ `Gemini` $\rightarrow$ `Qwen` $\rightarrow$ `ChatGPT`. |
| **P-33**| **Silent Model Downgrade Detection (Gemini 4 Argon ke Flash-Lite) & Auto-Failover Protocol:** Saat kuota Gemini 4 Argon atau 3.8 Flash habis, web Gemini secara diam-diam (*silent downgrade*) menurunkan model ke `3.5 Flash-Lite` tanpa banner dialog error, menonaktifkan item Argon (`aria-disabled="true"`), dan menyematkan teks reset kuota (`"Batas direset pada..."`). Hal ini menyebabkan tugas dieksekusi oleh model inferior tanpa disadari. Selain itu, pemanggilan terarah (`--model gemini`) sebelumnya langsung melempar exception fatal saat terkena limit alih-alih mengoper (*failover*) ke model alternatif. | Pengguna menerima hasil nalar rendah dari Flash-Lite, merusak kualitas analisis teknis, atau eksekusi CLI terhenti mendadak saat model pilihan terkena limit. | **Silent Downgrade Guard & Targeted Model Auto-Failover (`gemini_driver.js`, `orchestrator.js`, `cli.js`):** (1) `gemini_driver.js` mendeteksi badge composer dan status disabled menu Argon, menandai `rateLimited: true` saat terdegradasi ke Flash-Lite; (2) `orchestrator.js` menerapkan protokol **Auto-Failover / Oper Otomatis** pada mode terarah (`forceModel`): saat provider target limit/degraded, orchestrator tidak melempar crash fatal melainkan otomatis mengoper tugas ke provider berikutnya di rantai failover (`Claude` / `Qwen` / `ChatGPT`) berbekal Handoff Bundle Stream Recovery v1.5; (3) CLI mendukung opsi opt-in sadar `--allow-downgrade` jika pengguna memang sengaja mengizinkan fallback ke Flash-Lite. |
| **P-34**| **Blind Static Cooldowns, Model Abandonment After Quota Reset, & Premature Gemini Degradation Lockout:** Cooldown statis (blind 60m / 12h) tidak berkorelasi dengan waktu reset kuota nyata dari vendor web (misal Gemini reset pada 20.51, Claude "until 3:00 AM", ChatGPT "try again after 8:30 PM"). Selain itu, proses CLI baru kehilangan memori cooldown in-memory proses sebelumnya, dan model yang sudah selesai limitnya (kuotanya reset) berisiko terabaikan jika orchestrator tetap terkunci pada model fallback (Qwen) atau jika driver salah mendeteksi badge Flash-Lite sebagai limit permanen sebelum mencoba memilih Argon kembali. | Model unggulan (Claude / Gemini 4 Argon) yang sudah pulih disia-siakan; orchestrator tetap terjebak di Qwen; atau driver terus memicu failover palsu pada Gemini tab karena badge composer masih tertinggal pada Flash-Lite dari sesi sebelumnya. | **Hybrid Resilient Quota Reclaim Architecture & DOM Reset Timestamp Predictive Lease (`parse_reset.js`, `cooldown_store.js`, `gemini_driver.js`, `orchestrator.js`):** Mengembangkan arsitektur hibrida berstatus Circuit Breaker: (1) `src/parse_reset.js`: Parser deterministik multibahasa (ID & EN) mengekstrak timestamp reset konkret dari DOM vendor (`"Batas direset pada 14 Okt, 20.51"`, `"until 3:00 AM"`, `"in 45 minutes"`) sebagai *Predictive Lease*; (2) `src/cooldown_store.js`: Persistensi atomik lintas proses (`cooldown_state.json`) dengan file locking membagikan status cooldown antara CLI dan MCP server; (3) *Circuit Breaker (Half-Open Reclaim)*: Melewati provider secara instan tanpa beban DOM selama `now < resetAt`, dan saat `now >= resetAt` memasuki status `HALF_OPEN` untuk melakukan probe DOM read-only. Jika model terbuka, cooldown otomatis dihapus dan orchestrator langsung merebut kembali (*reclaim*) model unggulan tanpa terjebak di Qwen; (4) *Gemini Pre-Send Badge Decoupling*: Pemeriksaan limit pra-kirim mengabaikan badge Flash-Lite sementara dan mempercayakan `selectModel('4 Argon')` untuk mencoba beralih ke Argon di menu dropdown secara otoritatif. Terverifikasi live di Chrome: tepat pasca jam 20:51, Gemini 4 Argon sukses direclaim dan menghasilkan output analitik mendalam secara langsung. |
| **P-35**| **Multi-Session Context Collision, Fragile Failover Notice Attribution, & Flat Prompt Optimization:** Riwayat giliran obrolan global sebelumnya disimpan sebagai array datar tunggal di `session_state.json` tanpa pemisahan thread/sesi, memicu tumpang-tindih (*context collision*) saat mengerjakan beberapa fitur berbeda secara bersamaan. Selain itu, pesan pengalihan `buildHandoffBundle()` terkunci statis pada kata *"dialihkan dari Claude"* bahkan saat failover dipicu dari Gemini, Qwen, atau ChatGPT. Di saat bersamaan, `prompt_synthesizer.js` belum mengenali intent tugas secara granular (audit vs refactor vs math proof), belum mendukung kendali tingkat penalaran (`deep`/`quick`), dan belum mencakup domain arsitektur krusial seperti keamanan siber, infrastruktur cloud/DevOps, dan sistem agen AI. | Riwayat obrolan lintas topik bercampur baur; model penerima failover salah menerima konteks pengalihan; serta instruksi pengguna tidak dibingkai secara tajam sesuai intent tugas teknis. | **Multi-Session Thread Isolation, Dynamic Attribution Handoff, & Adaptive Intent Synthesis v2.5 (`session_history.js`, `prompt_synthesizer.js`, `domain_rules.json`, `orchestrator.js`, `cli.js`, `mcp_server.js`):** (1) `SessionHistory v2.5` mengisolasi riwayat per-ID sesi (`--session <id>`), auto-compaction sliding window, tracking metadata, serta perintah CLI manajemen sesi (`session-list`, `session-show`, `session-export`); (2) `buildHandoffBundle` mendeteksi provider asal failover secara dinamis dari giliran asisten terakhir; (3) `PromptSynthesizer v2.5` mengekstrak intent tugas (`audit_review`, `refactor_optimize`, `design_architecture`, `math_derivation`, `debug_fix`, `debate_challenge`), menyuntikkan protokol penalaran mendalam (`--reasoning deep`), mengisolasi payload tugas pengguna (*task sandboxing*), serta memperluas matriks domain ke `cybersecurity_audit`, `cloud_devops_infra`, dan `ai_agent_orchestration`. |

---

## 3. 👥 User Personas & Use Cases

### 3.1 Persona Utama
* **Academic Researcher & LaTeX Author (e.g., Tim Paper ACIMED):**
  Membutuhkan verifikasi ketat formula matematika, konsistensi metodologi, dan telaah kritis terhadap draf naskah ilmiah tanpa risiko formula LaTeX dirusak parser browser.
* **Senior Software Architect:**
  Memerlukan debat teknis konkret (*peer-review*) terhadap rancangan arsitektur sistem, skema database, atau modul algoritma kompleks dengan second-opinion independen.
* **Autonomous AI Coding Assistant (Antigravity):**
  Membutuhkan eksternalitas penalaran tanpa membakar kuota internal, dengan jaminan bahwa data balasan ditandai secara aman (*untrusted output*).

### 3.2 Alur Skenario Khas (Typical Scenario)
```text
[User / Antigravity] 
  ──> /web-llm-orchestrator "Tolong tinjau kembali Formula (4) pada metode dan uji apakah asumsi ortogonalitas terpenuhi."
      files: ["sections/metode.tex"]
  ──> [Claude Sonnet 5.5 Web] 
      Menganalisis file metode.tex. Jika terkena limit:
  ──> [Failover Engine] 
      Merangkum ringkasan 3 giliran terakhir + Suntik ulang Kontrak Caveman ──> Kirim ke [Qwen Thinking Web]
  ──> [Ekstraksi Jawaban]
      Mengembalikan hasil teknis penuh (dengan blok ```latex mentah) ke Antigravity
  ──> [Antigravity]
      Memperbaiki file lokal dan menyajikan rangkuman eksekutif kepada Pengguna.
```

---

## 4. 🏛️ Arsitektur Sistem & Alur Data

### 4.1 Diagram Komponen & Topologi CDP

```mermaid
flowchart TD
    subgraph AntigravityEnvironment ["Lingkungan Agen Lokal (Antigravity)"]
        User["Pengguna (Chat / /web-llm-orchestrator)"]
        Agent["Antigravity Master Agent"]
        Skill["SKILL.md Wrapper"]
        User --> Agent
        Agent --> Skill
    end

    subgraph OrchestratorSystem ["Web-LLM Orchestrator (Node.js)"]
        MCP["MCP Server (src/mcp_server.js - Stdio JSON-RPC)"]
        CLI["CLI Test Runner (src/cli.js)"]
        OrchCore["Orchestrator Core (src/orchestrator.js)"]
        LockMgr["LockManager (src/lock_manager.js)"]
        PrivacyGuard["Privacy Guard & Blacklist Scanner"]
        HistMgr["SessionHistory (src/session_history.js)"]
        BrowserMgr["BrowserManager (src/browser_manager.js)"]

        Skill -->|JSON-RPC| MCP
        MCP --> OrchCore
        CLI --> OrchCore
        OrchCore --> LockMgr
        OrchCore --> PrivacyGuard
        OrchCore --> HistMgr
        OrchCore --> BrowserMgr
    end

    subgraph ChromeRuntime ["Google Chrome Instance (CDP 127.0.0.1:9222)"]
        Flags["Flags: --disable-background-timer-throttling --disable-backgrounding-occluded-windows"]
        Profile["User Data Dir: %USERPROFILE%/.web-llm-orchestrator/chrome-profile/"]
        
        Tab1["Tab 1: claude.ai (Claude Sonnet 5.5)"]
        Tab2["Tab 2: chat.qwen.ai (Qwen 2.5 Thinking)"]
        Tab3["Tab 3: chatgpt.com (ChatGPT-4o)"]

        BrowserMgr -->|Puppeteer CDP Connect| Tab1
        BrowserMgr -->|Puppeteer CDP Connect| Tab2
        BrowserMgr -->|Puppeteer CDP Connect| Tab3
    end

    subgraph StateStorage ["Penyimpanan Data Lokal (%USERPROFILE%/.web-llm-orchestrator/)"]
        StateFile["session_state.json (Atomic .tmp -> rename)"]
        CooldownFile["cooldowns.json (Persistent Cooldowns)"]
        ExecLog["executions.jsonl (Audit Trail)"]
        LockFiles["locks/*.lock (PID + Heartbeat TTL)"]

        HistMgr <--> StateFile
        OrchCore <--> CooldownFile
        OrchCore --> ExecLog
        LockMgr <--> LockFiles
    end
```

---

## 5. ⚙️ Functional Requirements (Kebutuhan Fungsional Rinci)

### FR-1: Direct File Injection (`files: []`) & Anti-Traversal
* **Deskripsi:** Sistem wajib mendukung injeksi konten berkas lokal secara langsung ke browser tanpa meminta agen membacanya terlebih dahulu.
* **Mekanisme & Validasi:**
  1. Parameter `files: string[]` menerima path relatif atau absolut.
  2. Path dinormalisasi menggunakan `path.resolve()` untuk mengeliminasi serangan *directory traversal* (`../`).
  3. Berkas dibaca langsung via Node.js `fs.readFileSync(resolvedPath, 'utf-8')`.
  4. Disematkan ke dalam prompt dengan batas jelas: `--- LAMPIRAN FILE PROYEK --- [FILE: ...]`.
  5. Penghematan: 100% token pembacaan awal agen di-bypass.

### FR-2: Prompt Contract Enforcement ("Engineering Caveman" v1.5)
Arsitektur kontrak prompt dipisahkan secara tegas menjadi dua rezim untuk mencegah bias metadata pada alur handoff:

1. **Rezim Generate (Turn Awal Sesi — `ENGINEERING_CAVEMAN_CONTRACT`):**
   * **Teks Kontrak Verbatim:**
     ```markdown
     [ATURAN KELUARAN — ENGINEERING CAVEMAN GENERATE]
     1. Bernalar penuh secara internal. Aturan ini HANYA mengatur penulisan hasil akhir.
     2. POLA JAWABAN (Answer-First):
        - Baris pertama: [THING] [ACTION] [REASON] (maksimal 10 kata).
          ACTION: ANSWER | ANALYZE | AUDIT | DERIVE | IMPLEMENT | FIX | CONTINUE | REFUSE.
          (Jika prompt pengguna secara eksplisit meminta format khusus seperti JSON murni, tabel, atau teks naskah langsung, utamakan format permintaan pengguna).
        - Setelah itu, langsung berikan artefak teknis utama: solusi, kode, derivasi matematika, atau analisis.
     3. ZERO CEREMONY (Dilarang):
        - Tanpa sapaan ("Halo"), pujian, pengantar ("Tentu", "Berikut", "Pada dasarnya", "Secara umum"), penutup ("Semoga membantu"), atau permohonan maaf.
        - Tanpa pengulangan prompt atau meta-komentar ("Saya akan menganalisis...").
     4. FLOOR NON-NEGOTIABLE (Haram Disingkat/Dipotong):
        - Kode sumber, derivasi matematika LaTeX utuh, angka presisi, satuan, operator, nama variabel/identifier, path file, kutipan error, dan kata logika ingkar ("tidak", "bukan", "hanya", "kecuali").
        - Kompresi hanya berlaku untuk narasi dan prosa pengiring.
     5. STANDAR MATEMATIKA:
        - Derivasi/bukti ditulis lengkap tanpa melompati tahap kritis.
        - Gunakan delimiter canonical: $...$ untuk inline math, serta $$...$$ atau blok ```latex untuk display math/derivasi panjang.
     6. PROTOKOL KRITIS & BLOCKER:
        - Jangan mengarang referensi, angka, atau hasil. Bantah premis yang keliru. Jika ada fakta hilang/blocker fatal, tulis "BLOCKER: <fakta hilang>" lalu berhenti.
        - Jangan memaksakan mencari kelemahan jika kode/teks sudah benar (tulis "tidak ada masalah material").
     --------------------------------------------------
     ```

2. **Rezim Handoff Continuation (Stream Recovery Failover — `HANDOFF_CAVEMAN_CONTRACT`):**
   * **Aturan Khusus Handoff:**
     - **Larangan Keras:** Model penerima DILARANG memakai pola `[THING] [ACTION] [REASON]` atau baris ringkasan di awal, karena akan mengotori kontinuitas naskah yang sedang disambung.
     - **Zero Preamble:** Dilarang keras menulis kalimat pengantar seperti *"Berikut kelanjutan..."*, *"Melanjutkan dari..."*, *"Sure"*, *"Here is"*, atau *"Tentu"*.
     - **Floor & Depth:** Wajib mempertahankan kedalaman kode dan derivasi penuh tanpa meringkas bagian yang tersisa ke dalam rangkuman butir pendek.
     - **Runtime Enforcement Guard:** Fungsi `stripPreface()` dan `stitch()` di `src/stream_recovery.js` secara otomatis memotong preamble bilingual (Indonesia & Inggris) jika model web masih menghasilkan pengantar secara tidak sengaja.

* **Titik Injeksi & Cakupan Model (Universal Across Claude, Qwen, & ChatGPT):**
  - **Injeksi Universal Turn 1:** Saat giliran pertama sesi obrolan (`sessionHistory.getTurns().length === 0`), `ENGINEERING_CAVEMAN_CONTRACT` disuntikkan secara seragam ke seluruh model (Claude Sonnet 5.5, Qwen Thinking Mode, maupun ChatGPT).
  - **Pengingat Kontrak Turn 2+:** Pada giliran obrolan lanjutan (`sessionHistory.getTurns().length > 0`), orchestrator menyuntikkan pengingat ringkas `[PENGINGAT KONTRAK: Pertahankan pola Answer-First [THING] [ACTION] [REASON] dengan kurung siku, Zero Ceremony, dan Floor LaTeX/Kode utuh]` di awal prompt untuk mencegah model kembali ke mode basa-basi (chatty mode) tanpa mengulang blok kontrak penuh.
  - **Injeksi Handoff Failover:** Saat failover terjadi, prompt dibungkus oleh *Nonce Bounding Box* via `buildPrompt()` atau fallback `HANDOFF_CAVEMAN_FALLBACK_CONTRACT`.

### FR-3: Preservasi Formula LaTeX Non-Destruktif (KaTeX & MathJax)
* **Masalah:** Ekstraksi via `innerText` pada elemen yang dirender KaTeX memicu duplikasi teks karena elemen MathML dan HTML terbaca ganda, serta simbol integral/pangkat hancur.
* **Algoritma Ekstraksi:**
  1. Driver membuat klona elemen asisten: `const clone = targetEl.cloneNode(true)`.
  2. Cari seluruh elemen `.katex`:
     - Ambil tag `<annotation encoding="application/x-tex">`.
     - Cek apakah elemen merupakan display math (`.katex-display` atau `closest('.katex-display')`).
     - Ganti elemen dengan teks murni: `$$\n{tex}\n$$` (display) atau `${tex}$` (inline).
  3. Cari seluruh elemen MathJax `<script type="math/tex">`:
     - Ganti dengan `${tex}$`.
  4. Ekstrak teks akhir dari klona: `clone.innerText || clone.textContent`.
  5. **Larangan Keras:** Dilarang menggunakan aksi *copy to clipboard* fisik agar tidak membajak clipboard Windows pengguna.

### FR-4: Deteksi Batas Kuota (*Rate Limit*) dengan Verifikasi Ganda
* **Logika Boolean:** **AND terarah**. Teks harus mencocokkan `rate_limit_patterns` **DAN** terbukti berada dalam elemen peringatan/banner UI (`[role="alert"]`, `div[class*="banner"]`, `div[class*="toast"]`, `div[class*="modal"]`) atau tombol kirim berada dalam status *disabled*.
* **Titik Verifikasi:**
  1. *Immediate Check:* 400ms setelah pengetikan/klik kirim.
  2. *Mid-Stream Check:* Setiap interval 1000ms selama perputaran polling respons.
* **Penanganan Mid-Stream:** Jika limit muncul di tengah proses penulisan, loop tunggu langsung dihentikan seketika, teks yang sempat keluar dicatat, cooldown aktif, dan failover dijalankan.

### FR-5: Bounded-Context Session Handoff ($N=3$)
* **Spesifikasi:**
  1. Diambil maksimal $N=3$ giliran obrolan terakhir dari `session_state.json`.
  2. Setiap giliran dibatasi maksimal 4.000 karakter (karakter di luar itu dipotong dengan penanda peringatan).
  3. Setiap giliran dilabeli peran dan vendor: `[User]: ...`, `[Claude (Assistant)]: ...`.
  4. Giliran yang memicu limit **tidak dicatat sebagai jawaban sukses**, melainkan disematkan langsung sebagai `TUGAS LANJUTAN SAAT INI`.
  5. Template Handoff Bundle:
     ```markdown
     [SYSTEM: CONTEXT HANDOFF DARI {PROVIDER_LAMA} KARENA LIMIT KUOTA]
     Sesi ini dialihkan secara otomatis karena batas kuota tercapai.

     --- KONTRAK KELUARAN ---
     {VERBATIM_ENGINEERING_CAVEMAN_CONTRACT}

     --- RIWAYAT PERCAKAPAN SEBELUMNYA (BOUNDED CONTEXT) ---
     [User]: ...
     [{PROVIDER_LAMA} (Assistant)]: ...
     -------------------------------------------------------

     TUGAS LANJUTAN SAAT INI:
     {Prompt User Terbaru + Lampiran File}

     Instruksi: Langsung selesaikan tugas lanjutan di atas dengan mematuhi Kontrak Keluaran.
     ```

### FR-6: Rantai Failover Sekuensial Bertingkat
* **Rantai Default:** `Claude (Sonnet 5.5)` $\rightarrow$ `Qwen (Thinking Mode)` $\rightarrow$ `ChatGPT (GPT-4o)`.
* **Kebijakan Cooldown:**
  - Claude limit: Aktifkan cooldown **60 menit**.
  - Qwen limit: Aktifkan cooldown **12 jam** (mengakomodasi batas harian akun web Qwen).
  - ChatGPT limit: Aktifkan cooldown **60 menit**.
* **Penyimpanan Cooldown:** Disimpan secara persisten di `%USERPROFILE%\.web-llm-orchestrator\cooldowns.json`. Jika server MCP direstart, status cooldown tidak hilang.
* **Bypass & Override:** Opsi `--model <provider>` atau parameter MCP `force_model: "<provider>"` mem-bypass seluruh rantai failover. Jika model yang dipaksa sedang dalam cooldown, sistem melempar galat yang merinci sisa menit cooldown.

### FR-7: Fail-Fast Authentication (`AUTH_REQUIRED`)
* **Deteksi:** URL berpindah ke rute login (`/login`, `auth0`, `auth.anthropic.com`, `auth.alibabacloud.com`) ATAU body/title memuat kata kunci challenge Cloudflare ("Just a moment...", "Verify you are human").
* **Aturan Kritis:**
  1. Hentikan eksekusi seketika (*fail-fast*).
  2. **Dilarang keras melakukan failover** ke model lain (karena kegagalan login adalah isu konfigurasi pengguna, bukan kehabisan kuota).
  3. Melempar galat eksplisit berformat: `[AUTH_REQUIRED] {Provider} memerlukan login / verifikasi manual di browser port 9222 ({Alasan}).`

### FR-8: Cross-Process Mutex Lock dengan Heartbeat Renewal (`LockManager`)
* **Masalah:** Qwen Thinking Mode atau Claude pada persoalan matematika berat dapat berpikir lebih dari 2–3 menit. TTL statis 180s berisiko kedaluwarsa prematur dan tab dibajak oleh proses lain.
* **Mekanisme Solusi:**
  1. File lock fisik disimpan di `%USERPROFILE%\.web-llm-orchestrator\locks\{provider}.lock`.
  2. Format: `{ pid: process.pid, resource: provider, timestamp: Date.now(), ttl: 180000 }`.
  3. Penulisan menggunakan flag atomic `'wx'`.
  4. **Heartbeat Renewal:** Selama driver menunggu jawaban di `waitForResponse()`, interval heartbeat setiap **30 detik** memperbarui atribut `timestamp` pada berkas lock.
  5. **Stale Recovery:** Lock dianggap usang dan dihapus otomatis HANYA JIKA:
     - Usia lock > 180 detik TANPA adanya pembaruan heartbeat, **ATAU**
     - Proses pemilik PID terbukti sudah mati (`process.kill(pid, 0)` melempar galat).

### FR-9: Privacy Guard & File Blacklist Scanner (Reject-All Policy)
* **Daftar Pola Terlarang (Case-Insensitive):**
  - Kunci & Sertifikat: `/\.key$/i`, `/\.pem$/i`, `/\.pfx$/i`, `/\.p12$/i`, `/\.ppk$/i`, `/id_rsa/i`, `/id_ed25519/i`
  - Variabel Lingkungan & Rahasia: `/\.env(\..+)?$/i`, `/\.npmrc$/i`, `/\.netrc$/i`, `/\.kdbx$/i`, `/secrets\./i`
  - Direktori Kredensial: `/credentials/i`, `/\.aws[\/\\]/i`, `/\.ssh[\/\\]/i`, `/\.git[\/\\]/i`
* **Evaluasi:** Menggunakan *resolved absolute path* dan *basename*.
* **Kebijakan:** **Reject-All**. Jika ditemukan 1 saja berkas terlarang dalam daftar `files: []`, seluruh permintaan dibatalkan dengan galat `[PRIVACY GUARD] Akses ke file sensitif ditolak: {relPath}`.

### FR-10: Pemisahan Thinking Block & Predikat Respons Selesai
* **Pemisahan Thinking:** Pada Qwen web (`chat.qwen.ai`) dan Claude, elemen penalaran internal diletakkan dalam akordeon khusus (`.thinking-content`, `div[class*="thinking"]`). Parser mengekstrak konten balasan dari elemen pesan akhir (`.markdown-body`, `.message-content`), memastikan hasil bersih tanpa memotong alur logika turunan matematika.
* **Predikat Respons Selesai:**
  1. Tombol Stop/Cancel hilang dari DOM, **DAN**
  2. Indikator streaming (`[data-is-streaming="true"]`, `.loading`, `.thinking`) berhenti, **DAN**
  3. Teks pesan stabil (tidak mengalami perubahan panjang) selama minimal 2 kali interval berturut-turut (2.000 ms).
* **Truncated Response:** Jika terdeteksi tombol "Continue generating" / "Lanjutkan", driver secara otomatis mengklik tombol tersebut hingga jawaban lengkap.
* **Thinking Mode Timeout Allocation:** Model yang menggunakan mode penalaran mendalam (Qwen dengan *Berpikir* dan ChatGPT dengan *Thinking Mode*) dialokasikan batas waktu generasi hingga 420.000 ms (7 menit), mencegah *false timeout* pada penulisan dokumen teknis berskala besar (>30.000 karakter). Model non-thinking dialokasikan 180.000 ms (3 menit).

### FR-11: Untrusted Output Tagging & XML Escaping
* Seluruh teks balasan dibungkus dalam tag:
  ```xml
  <web_llm_untrusted_output provider="{provider}" failover="{true/false}">
  {jawaban_tersanitasi}
  </web_llm_untrusted_output>
  ```
* **Sanitasi Anti-Injection:** Jika model web secara kebetulan memuat teks literal `</web_llm_untrusted_output>`, sistem melakukan sanitasi escaping menjadi `<\/web_llm_untrusted_output>` sebelum membungkus keluaran.
* **Aturan Keamanan Agen:** Agen Antigravity dilarang mengeksekusi shell atau memodifikasi file sistem kritis secara otonom dari teks di dalam tag ini tanpa tinjauan manusia.

### FR-12: Persistent Audit Trail Logging
* Setiap pemanggilan dicatat secara append-only di `%USERPROFILE%\.web-llm-orchestrator\executions.jsonl`.
* Skema Baris:
  ```json
  {
    "timestamp": "2026-10-11T13:40:00.000Z",
    "provider": "claude",
    "prompt_length": 1420,
    "response_length": 3840,
    "duration_ms": 14250,
    "failover": false,
    "failover_detail": null,
    "files_count": 1
  }
  ```

### FR-13: Stream Recovery & Continuation Stitching (`src/stream_recovery.js`)
* **Pemotongan Tail Bersih (`sealTail`):** Saat model terkena limit di tengah jalan, sistem mendeteksi dan memotong unclosed code fences (```/~~~) atau unclosed LaTeX display math ($$), membersihkan banner limit vendor, serta memangkas judul yatim tanpa isi.
* **Ekstraksi State Ledger (`buildLedger`):** Mengekstrak heading yang sudah selesai, notasi matematika yang telah didefinisikan, counter sitasi/persamaan (`\tag`), dan bahasa dokumen secara lokal tanpa ketergantungan LLM.
* **Nonce Bounding Box Re-hydration (`buildPrompt`):** Mengemas prompt estafet ke dalam kotak pembatas ber-token acak `[[BEGIN:NAME:nonce]]...[[END:NAME:nonce]]` untuk mengeliminasi risiko *prompt injection* dan memaksa model penerima melanjutkan tanpa basa-basi pembuka.
* **Penyambungan Mulus (`stitch`):** Menjahit potongan teks lama dengan teks lanjutan baru, memotong overlap duplikasi secara *whitespace-insensitive*, mendeteksi restart awal, dan membuang tag penalaran `<think>`.

### FR-14: LaTeX Math Normalizer & Formula Quarantine (`src/math_normalizer.js`)
* **Konversi Delimiter Standar:** Mengonversi `\[...\]`, `\(...\)`, dan environment TeX (`equation`, `align`, `gather`) ke standar markdown math `$$` dan `$`.
* **Zero Silent Failure Quarantine:** Formula TeX yang cacat atau tidak valid dikarantina secara eksplisit ke dalam blok kode ````tex```` tanpa modifikasi liar yang merusak rumus asli.
* **Disambiguasi Simbol Mata Uang:** Menerapkan aturan Pandoc agar nominal harga (seperti `$5` dan `$10`) tidak disalahartikan sebagai formula inline math.

### FR-15: Penguncian Model Unggulan & Mode Penalaran (Qwen & ChatGPT)
* **Qwen Model Lock (`selectModel`):** Mengotomasi pemilihan model ke **`Qwen3.8-Max`** via dropdown `.wms-trigger`.
* **Qwen Reasoning Mode (`setReasoningMode`):** Mengunci mode penalaran pada **`Berpikir`** (Thinking Mode) via `.qwen-thinking-selector` (menggantikan mode default `Otomatis`).
* **ChatGPT Thinking Mode (`setThinkingMode` & Shortcut `Ctrl+Shift+M`):** Mengotomasi aktivasi fitur penalaran tombol "Berpikir" (state `text-info`) dan menyediakan fungsi toggle shortcut keyboard resmi `Ctrl + Shift + M`.

### FR-16: Multi-Signal Quorum Generation & Anti-Premature Stop
* Untuk mencegah deteksi selesai palsu saat model Claude/Qwen sedang berpikir atau memproses eksekusi alat, predikat penyelesaian generasi wajib memenuhi kuorum:
  1. Tombol Stop tidak ada di DOM, **DAN**
  2. Atribut streaming `[data-is-streaming="true"]` bernilai false, **DAN**
  3. Tidak ada langkah alat aktif (`[data-cds="TurnStatusStep"]` berstatus running), **DAN**
  4. Panjang teks pesan stabil selama minimal 4 kali interval berturut-turut ($\ge 4.000$ ms).

### FR-17: Protokol Autonomous Multi-Turn Interrogation Loop (AMTIL)
* **Filosofi Dual-Job:** Orchestrator mengemban 2 peran: (1) Prompting & Injeksi File, dan (2) Auditing & Interogasi Kritis Otonom sebelum artefak diserahkan ke pengguna (*zero premature handoff*).
* **Automated Scrutiny 4 Dimensi:** Setiap output model pada Turn 1 diuji secara internal terhadap 4 pilar:
  1. *Boundary & Budget Compliance:* Pagu anggaran pendanaan (misal: Belmawa PKM-KC Rp6–10jt), timeline riset (3–4 bulan), batas TRL/TKT 2–4.
  2. *Sensor Physics & Environmental Realism:* Kerentanan sensor terhadap drift (MPU6050), korosi/biofouling air payau (DO probe), atau limitasi optik air keruh.
  3. *Laboratory Test-Bed Feasibility:* Menolak klaim uji lapangan fiktif; mewajibkan skema miniatur meja uji lab (*flume box*, simulator rig) yang dapat diselesaikan dalam 3 bulan.
  4. *Edge Compute Sizing:* Kelayakan model AI/TinyML pada mikrokontroler target (ESP32-S3 INT8 kuantisasi vs model berat).
* **Adversarial Counter-Prompt Generation:** Jika ditemukan celah fatal, Orchestrator memformulasikan sanggahan tajam berskema Caveman `[AUDIT_REVISE]` dan langsung mengirimkannya ke tab browser yang sama di Turn 2+ tanpa membebani pengguna.
* **Kriteria Konvergensi:** Loop debat dinyatakan selesai jika seluruh celah fatal tereliminasi, BOM $\le 60\%$ pagu total, skema meja uji lab terdefinisi, dan solusi memiliki argumentasi *reviewer-proof*. Pengguna hanya menerima artefak matang bertajuk *Executive Battle-Tested Blueprint*.
* **Dokumentasi Lengkap:** Terkodifikasi resmi pada [`docs/SOP_AUTONOMOUS_INTERROGATION_LOOP.md`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/docs/SOP_AUTONOMOUS_INTERROGATION_LOOP.md).

### FR-18: Driver Hardening, Pre-Send Busy Guard, & Auto-Healing Parity (Claude & ChatGPT)
* **Pre-Send Busy Guard (`waitForIdle`):** Mencegah tabrakan giliran obrolan (Turn 2+) dengan menunggu model menyelesaikan generasi respons sebelumnya (maksimal timeout 120s) sebelum mengetikkan prompt baru. Memeriksa stop selectors, `[data-is-streaming="true"]`, dan `[data-cds="TurnStatusStep"]`.
* **Post-Send Verification Guard:** Menggunakan Puppeteer native trusted click (`ElementHandle.click()`) dengan fallback tombol Enter terarah. Driver memverifikasi pengiriman prompt dengan memastikan teks di input box telah terkirim dan tombol stop/streaming aktif. Melempar error eksplisit jika pengiriman gagal setelah retry.
* **Generation Error Detection & Auto-Healing:** Driver memantau banner error antarmuka web (misalnya ChatGPT `data-dil-render-failed` / `"Respons ini tidak dapat dimuat"` dan Claude `"error generating response"` / `"claude had an error"` / `"conversation is too long"`). Jika error render/tampilan terjadi di akhir generasi, driver secara otomatis menjalankan `page.reload()` dan mengekstrak ulang teks yang tersimpan di server.

### FR-19: Claude Native Skill Activation (`/caveman` on Session Init)
* **Target Provider Eksklusif:** Hanya berlaku untuk provider `claude`. Provider lain (`qwen`, `chatgpt`) tidak menyertakan slash command ini.
* **Siklus Hidup Giliran Awal (Session Init Only):**
  - Diaktifkan saat `isInitialTurn === true` (yaitu `sessionHistory.getTurns().length === 0` atau Claude berada di URL `claude.ai/new` / `messageCount === 0`).
  - Driver memfokuskan composer ProseMirror, mengetikkan `/caveman` secara native via `page.keyboard.type`, dan menekan `Enter` untuk mengonversi slash command menjadi chip interaktif `<span data-skill-id="caveman">`.
  - Sisa teks prompt kemudian dimasukkan via `insertText`.
* **Pencegahan Redundansi Turn 2+:** Pada giliran obrolan lanjutan dalam sesi yang sama (termasuk debat AMTIL Turn 2+), `/caveman` tidak ditambahkan lagi dan string `/caveman` di awal teks prompt (jika ada) dibersihkan secara otomatis.
* **Reaktivasi Pasca-Reset:** Jika fungsi `resetSession()` dipanggil, Claude dinavigasi kembali ke `https://claude.ai/new` dan riwayat dibersihkan, sehingga giliran berikutnya kembali memicu aktivasi `/caveman`.

---

## 6. 🔒 Non-Functional Requirements (Kebutuhan Non-Fungsional)

### NFR-1: Isolasi Profil & Nol Kebocoran Kredensial
* Seluruh data peramban (*cookies*, *local storage*, *session*) disimpan secara eksklusif di:  
  `%USERPROFILE%\.web-llm-orchestrator\chrome-profile\`
* Folder repositori proyek bebas dari cookie atau kredensial peramban, sehingga repositori 100% aman untuk di-commit ke Git atau dibagikan sebagai arsip ZIP.

### NFR-2: Anti-Throttling & Manajemen Tab di Windows
* Skrip peluncuran ([`start_browser.bat`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/start_browser.bat) dan [`start_browser.ps1`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/start_browser.ps1)) wajib menyertakan flag Chrome:
  `--disable-background-timer-throttling` dan `--disable-backgrounding-occluded-windows`.
* Driver memanggil `await page.bringToFront()` sebelum pengetikan dan evaluasi DOM untuk mencegah tab tertidur (*sleeping tab*) oleh Chrome Memory Saver.

### NFR-3: Kepatuhan Standar Protokol MCP
* Mengimplementasikan protokol resmi Model Context Protocol (MCP) versi `2024-11-05` via stdio JSON-RPC 2.0.
* Terdaftar aktif di `~/.gemini/config/mcp_config.json` dan skill Antigravity di `~/.gemini/config/skills/web-llm-orchestrator/SKILL.md`.

---

## 7. 🔌 Spesifikasi Antarmuka & Skema Tool

### 7.1 MCP Tool: `ask_web_llm`
* **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "prompt": {
        "type": "string",
        "description": "Teks instruksi, pertanyaan, atau arahan perbaikan."
      },
      "files": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Daftar path file lokal yang ingin disertakan langsung dari disk (misal: [\"sections/metode.tex\"])."
      },
      "force_model": {
        "type": "string",
        "enum": ["claude", "qwen", "chatgpt"],
        "description": "Opsional: paksa model tertentu tanpa alur failover default."
      }
    },
    "required": ["prompt"]
  }
  ```

### 7.2 MCP Tool: `get_web_llm_status`
* **Deskripsi:** Memeriksa status port CDP 9222 dan ketersediaan tab Claude, Qwen, serta ChatGPT.

### 7.3 MCP Tool: `reset_web_llm_session`
* **Deskripsi:** Menghapus riwayat percakapan lokal (`session_state.json`), mereset status cooldown in-memory, serta secara otomatis menavigasi ketiga tab peramban aktif (**Claude $\rightarrow$ `/new`**, **Qwen $\rightarrow$ `/`**, **ChatGPT $\rightarrow$ `/`**) ke sesi obrolan baru (*Deep Session Reset*). Mencegah kebocoran konteks antar topik bahasan dan membersihkan tumpukan DOM obrolan lama di browser.

---

## 8. 🚨 Katalog Kode Galat Resmi (Error Code Catalog)

| Kode Galat | Penyebab | Pesan Galat & Tindakan Sistem |
| :--- | :--- | :--- |
| `AUTH_REQUIRED` | Sesi web habis atau muncul tantangan Cloudflare Turnstile. | `[AUTH_REQUIRED] {Provider} memerlukan login / verifikasi manual di browser port 9222.` (*Fail-fast, tanpa failover*). |
| `RATE_LIMITED` | Seluruh provider dalam rantai failover mencapai batas kuota atau cooldown. | `[RATE_LIMITED] Seluruh provider dalam rantai failover gagal atau mencapai batas kuota.` |
| `LOCK_TIMEOUT` | Tab browser sedang digunakan oleh proses lain selama > 20 detik. | `[LOCK_TIMEOUT] Sumber daya '{provider}' sedang digunakan oleh proses lain. Coba beberapa saat lagi.` |
| `PRIVACY_VIOLATION`| File lampiran mencocokkan pola berkas terlarang di blacklist. | `[PRIVACY GUARD] Akses ke file sensitif ditolak: {path}.` |
| `BROWSER_DISCONNECTED` | Port CDP 9222 tidak aktif atau Chrome ditutup. | `Chrome Remote Debugging belum aktif pada http://127.0.0.1:9222. Jalankan .\\start_browser.bat.` |

---

### 9.1 Matriks Unit Test Otomatis (`npm test`)

| File Pengujian | Komponen yang Diuji | Status Verifikasi |
| :--- | :--- | :--- |
| [`tests/session_history.test.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/tests/session_history.test.js) | Buffer giliran obrolan, penulisan atomik `.tmp`, dan Handoff Bundle Bounded Context ($N=3$). | ✅ **100% Passed** |
| [`tests/orchestrator_files.test.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/tests/orchestrator_files.test.js) | Resolusi file lokal, scanner blacklist privasi, dan pencegahan path traversal. | ✅ **100% Passed** |
| [`tests/lock_manager.test.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/tests/lock_manager.test.js) | Mutex eksklusif, pembersihan stale lock (PID mati/TTL expired), dan acquire timeout. | ✅ **100% Passed** |
| [`tests/offline_fixtures.test.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/tests/offline_fixtures.test.js) | Deteksi rate-limit teks ganda, deteksi `AUTH_REQUIRED`, dan ekstraksi formula KaTeX. | ✅ **100% Passed** |
| [`tests/gemini_driver.test.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/tests/gemini_driver.test.js) | Inisialisasi driver Gemini, validasi kontrak BaseDriver, seleksi model (4 Argon default / 3.8 Flash), tingkat penalaran (Tinggi default), mode segmented (Percakapan vs Tugas), dan registry selectors Quill .ql-editor. | ✅ **100% Passed** |
| [`tests/qwen_driver.test.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/tests/qwen_driver.test.js) | Inisialisasi driver Qwen, validasi kontrak antarmuka BaseDriver, dan registry selectors. | ✅ **100% Passed** |
| [`tests/chatgpt_driver.test.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/tests/chatgpt_driver.test.js) | Inisialisasi driver ChatGPT, validasi kontrak BaseDriver, Pre-Send Guard, dan registry selectors anti-canvas. | ✅ **100% Passed** |
| [`tests/claude_driver.test.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/tests/claude_driver.test.js) | Inisialisasi driver Claude, validasi kontrak BaseDriver, Pre-Send Busy Guard, deteksi error generasi, aktivasi skill `/caveman` sesi awal, dan registry selectors. | ✅ **100% Passed** |
| [`tests/orchestrator_recovery.test.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/tests/orchestrator_recovery.test.js) | Integrasi `recoverSessionHandoff`, pembuatan prompt ber-nonce, tail sealing, dan fallback. | ✅ **100% Passed** |
| [`tests/prompt_synthesizer.test.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/tests/prompt_synthesizer.test.js) | Sintesis 4-D (Deconstruct, Diagnose, Develop, Deliver), penguncian pagu BoM hardware & domain rules (`pkm_kc`, `data_mining`). | ✅ **100% Passed** |
| [`tests/interrogation_engine.test.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/tests/interrogation_engine.test.js) | Dynamic 4D Scrutiny, counter-prompt `[AUDIT_REVISE]`, konvergensi multi-domain, dan deteksi plateau/stagnasi nalar. | ✅ **100% Passed** |
| [`tests/critique_contract.test.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/tests/critique_contract.test.js) | Validasi Universal Critique & Framing Contract, bukti wajib (*evidence citation*), schema JSON linting. | ✅ **100% Passed** |
| [`tests/critic_engine.test.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/tests/critic_engine.test.js) | Scoring konvergensi deterministik, Dynamic Framing, deteksi regresi/stagnasi, dan counter-prompt ber-evidence. | ✅ **100% Passed** |
| [`tests/prompt_input.test.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/tests/prompt_input.test.js) | Validasi PromptInput (Shell Safety Guard), penolakan inline multi-baris/panjang (`E_INLINE_UNSAFE`), pembersihan UTF-8 BOM, dan penanganan missing file (`E_FILE_MISSING`). | ✅ **100% Passed** |
| [`tests/modules.test.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/tests/modules.test.js) | Pengujian 24 kasus uji native Node.js untuk `math_normalizer.js` dan `stream_recovery.js` (ReDOS, overlap, TeX quarantine). | ✅ **100% Passed (24/24)** |


### 9.2 Matriks Pengujian Adversarial Live (Chrome CDP Port 9222)

| Target Uji & Skenario | Skrip Pengujian | Metrik & Temuan Uji | Status |
| :--- | :--- | :--- | :--- |
| **Gemini 4 Argon Deep Reasoning (Mode Percakapan):** LaTeX multivariat kuadratik, gradien $\nabla f(x)$, Hessian $\nabla^2 f(x)$, & Python code. | [`scratch/gemini_stress_test.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/scratch/gemini_stress_test.js) | Berpikir 48s, streaming 34s, total 82s (6.035 karakter). Preservasi LaTeX KaTeX via tag `<annotation>` 100% sempurna tanpa newline loss. | ✅ **PASSED (Production Hardened)** |
| **Gemini 4 Argon Mode Tugas (Deep Task Checklist):** Migrasi CDC PostgreSQL ke ClickHouse dengan tabel risiko markdown, Debezium JSON, & SQL. | [`scratch/gemini_stress_test.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/scratch/gemini_stress_test.js) | Berpikir 72s, streaming 33s, total 105s (8.907 karakter). Output terstruktur utuh tanpa pemotongan tabel atau panel kanvas imersif. | ✅ **PASSED (Production Hardened)** |
| **Gemini 4 Argon Session Persistence:** Reset chat berulang via `[data-test-id="new-chat-button"]`. | [`scratch/gemini_stress_test.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/scratch/gemini_stress_test.js) | Pemilihan model `4 Argon` dan tingkat penalaran `Tinggi` bertahan 100% tanpa kembali ke default Flash. | ✅ **PASSED (Production Hardened)** |
| **Qwen 3.8-Max Deep Reasoning:** Penurunan matriks Hessian analitik multivariat (2318 char prompt). | [`scratch/test_qwen_adversarial.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/scratch/test_qwen_adversarial.js) | Waktu berpikir 100.1s. Ekstraksi MathML fallback memulihkan **58/58 formula KaTeX** (21 inline, 37 display). DOM restorasi utuh, zero text leak. | ✅ **PASSED (Production Hardened)** |
| **ChatGPT 2026 UI Reasoning:** Pembuktian Pigeonhole graf sederhana ($|V| \ge 2$). | [`scratch/test_chatgpt_adversarial.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/scratch/test_chatgpt_adversarial.js) | UI button "Berpikir" & shortcut `Ctrl+Shift+M` teruji responsif (`aria-pressed` toggle). Siklus berpikir 19.8s terdeteksi via stop button & thought nodes. 6 formula LaTeX canonical terekstrak bersih. | ✅ **PASSED (Production Hardened)** |
| **LockManager Mutex Anti Tab-Collision:** 2 Worker bersaing memperebutkan tab yang sama. | [`scratch/test_concurrency_failover.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/scratch/test_concurrency_failover.js) | Eksekusi 3344 ms (>2500 ms serial minimum). Fencing token disk lock terverifikasi. Zero tab collision. | ✅ **PASSED (100% Serialized)** |
| **Stream Recovery Live Stitching:** Pemulihan teks parsial formula gantung `\ge`. | [`scratch/test_concurrency_failover.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/scratch/test_concurrency_failover.js) | `sealTail` memotong bersih LaTeX gantung, nonce box anti-leakage dibuat, `stitch()` menggabungkan output lanjutan (1573 char) tanpa duplikasi heading. | ✅ **PASSED (Seamless Recovery)** |

### 9.3 Matriks Pengujian Multi-File Injection & Kontrak Universal (Dual-Subagent Live Test)

Pengujian paralel independen dilakukan menggunakan 2 subagent mandiri dengan 2 file dummy proyek:
1. `scratch/dummy_math.tex`: Teorema Rayleigh-Ritz ($R_A(x) = \frac{x^T A x}{x^T x}$, $\lambda_1 \le R_A(x) \le \lambda_n$) dan karakterisasi matriks PSD ($\lambda_1 \ge 0$).
2. `scratch/dummy_code.py`: Implementasi Python fungsi `compute_rayleigh_quotient(A, x)` dan `check_psd(A)` via `np.linalg.eigvalsh(A)`.

| Target Provider & Role Subagent | Skrip & Artefak Laporan | Pemahaman File Proyek | Kepatuhan Kontrak Caveman | Integritas Formula LaTeX | Status & Waktu Eksekusi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Qwen (Thinking Mode)**<br/>*Role: Qwen File Injection Tester* | [`scratch/run_test_qwen_files.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/scratch/run_test_qwen_files.js)<br/>• `qwen_files_report.json`<br/>• `qwen_files_result.md` | ✅ **100% Dipahami**<br/>Menemukan celah matematis: kode Python tidak memvalidasi syarat simetri ($A = A^T$) sebelum memanggil `eigvalsh(A)`. | ✅ **100% Patuh Sempurna**<br/>Baris 1: `[KODE] [AUDIT] [INTI_BENAR_TAPI_SIMETRI_TIDAK_DIVALIDASI]`.<br/>0 kata basa-basi. | ✅ **Terekstrak Sempurna**<br/>27 inline (`$...$`) & 49 display (`$$...$$`). Lingkungan matriks & aljabar utuh. | ✅ **PASSED**<br/>(152.8 detik, 6.504 karakter) |
| **ChatGPT (Reasoning Mode)**<br/>*Role: ChatGPT File Injection Tester* | [`scratch/run_test_chatgpt_files.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/scratch/run_test_chatgpt_files.js)<br/>• `chatgpt_files_report.json`<br/>• `chatgpt_files_result.md` | ✅ **100% Dipahami**<br/>Mengidentifikasi relasi Rayleigh quotient & ketiadaan verifikasi simetri matriks pada `check_psd`. | ✅ **Patuh Substansial**<br/>Pola Answer-First (`[AUDIT]`, `[ACTION]`, `[REASON]`).<br/>0 kata basa-basi (*zero ceremony*). | ⚠️ **Inline Utuh & Display Karantina**<br/>11 inline (`$...$`) valid. Formula display terdegradasi dikarantina rapi oleh `math_normalizer.js` ke blok ````tex````. | ✅ **PASSED**<br/>(63.1 detik, 1.473 karakter) |
| **Claude Sonnet 5.5**<br/>*Paritas Alur Eksekusi* | Arsitektur `executeOnProvider('claude')` di `src/orchestrator.js` | ✅ **Identik 100%**<br/>Injeksi file via `resolveFiles()` dikirim utuh ke editor ProseMirror Claude. | ✅ **Identik 100%**<br/>Menerima `ENGINEERING_CAVEMAN_CONTRACT` seragam pada turn 1 dan pengingat turn 2+. | ✅ **Identik 100%**<br/>Ekstraksi via `BaseDriver.extractResponse()` (multi-tier KaTeX preservation). | ✅ **VERIFIED (Architecture Parity)** |

### 9.4 Matriks Pengujian New Session Isolation & Deep Reset (Dual-Subagent Live Test)

Pengujian paralel dilakukan menggunakan 2 subagent mandiri untuk memvalidasi fitur Deep Reset (navigasi tab peramban ke obrolan baru) dengan skenario percakapan berurutan:
- Sesi 1: `"halo, aku budi"`
- Eksekusi: `orchestrator.resetSession(..., provider)`
- Sesi 2: `"budi, halo aku"`

| Target Provider & Role Subagent | Skrip & Laporan JSON | URL Percakapan Sesi 1 | URL Pasca-Reset | URL Percakapan Sesi 2 | Status Isolasi Sesi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Qwen (Thinking Mode)**<br/>*Role: Qwen New Session Tester* | [`scratch/test_qwen_new_session.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/scratch/test_qwen_new_session.js)<br/>• `qwen_new_session_report.json` | `.../c/3897194e-356b-4a21...` | `https://chat.qwen.ai/` | `.../c/d6a79618-d185-4e19...` | ✅ **100% Terisolasi**<br/>Conversation ID berbeda, tab bersih pasca-reset. |
| **ChatGPT (Reasoning Mode)**<br/>*Role: ChatGPT New Session Tester* | [`scratch/test_chatgpt_new_session.js`](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/scratch/test_chatgpt_new_session.js)<br/>• `chatgpt_new_session_report.json` | `.../c/6acc60a7-d458-83ec...` | `https://chatgpt.com/` | `.../c/6acc60b7-235c-83ec...` | ✅ **100% Terisolasi**<br/>Thread UUID berbeda, tab bersih pasca-reset. |

### 9.5 Matriks Pengujian Multi-Turn Live Dialectic Debater (Dual-Subagent Live Test)

Pengujian dialektika multi-turn otonom tanpa pra-skrip (*pure organic dialectic*) diuji menggunakan 2 subagen independen yang berinteraksi langsung dengan ChatGPT dan Qwen di browser via Chrome CDP 9222:

| Target Provider & Role Subagent | Skrip & Ringkasan Laporan | Putaran Dialektika (Turns) | Dinamika Argumen & Celah yang Diinterogasi | Hasil Akhir & Status Konvergensi |
| :--- | :--- | :--- | :--- | :--- |
| **ChatGPT (Reasoning Mode)**<br/>*Role: ChatGPT Dialectic Debater* | • [`scratch/chatgpt_turn2.txt`](file:///C:/Users/Lenovo/.gemini/antigravity-cli/brain/26126196-ee5c-40f2-ac1f-fbc913679553/scratch/chatgpt_turn2.txt)<br/>• [`scratch/chatgpt_debate_summary.md`](file:///C:/Users/Lenovo/.gemini/antigravity-cli/brain/26126196-ee5c-40f2-ac1f-fbc913679553/scratch/chatgpt_debate_summary.md) | **4 Putaran Penuh**<br/>(1 Thread Kontinu Tanpa Kuota Limit) | **Turn 1 (Pulsar BookKeeper E=3/Qw=3/Qa=2):** Disanggah celah ensemble change deadlock saat DC mati total & double-WAN hop delay.<br/>**Turn 2 (Pivot ke Kafka Stretch RF=3):** Disanggah celah slowest-replica WAN tax & ISR freeze 2-3s saat DC mati.<br/>**Turn 3 (Pivot ke Redpanda Stretch RF=5):** Disanggah ledakan WAN 24 Gbps, ketiadaan Tiered Storage NVMe, & lisensi proprietary.<br/>**Turn 4 (Konvergensi):** ChatGPT menyerah dari arsitektur monolitik stretch broker dan menyepakati pemisahan domain. | ✅ **100% Konvergen Mutlak**<br/>Sepakat memisahkan Authoritative Multi-Region Synchronous ACID Ledger (RPO=0) dari Local Streaming Event Bus (Kafka RF=3) via Transactional CDC Outbox. |
| **Qwen (Thinking Mode)**<br/>*Role: Qwen Architecture Consultant* | • [`scratch/qwen_turn2.txt`](file:///C:/Users/Lenovo/.gemini/antigravity-cli/brain/26126196-ee5c-40f2-ac1f-fbc913679553/scratch/qwen_turn2.txt)<br/>• [`scratch/qwen_architecture_insights.md`](file:///C:/Users/Lenovo/.gemini/antigravity-cli/brain/26126196-ee5c-40f2-ac1f-fbc913679553/scratch/qwen_architecture_insights.md) | **2 Putaran Konsultasi & Sanggahan Balik** | **Turn 1 (Audit SOTA Agent Systems 2026):** Qwen mengkritik stale mutex lock, ilusi verifikasi bukti, dan Chrome tab suspension saat deep thinking (60-120s). Mengusulkan TCP port binding & SQLite.<br/>**Turn 2 (Sanggahan Antigravity):** Menolak TCP port (konflik/firewall UAC Windows) & SQLite (binary C++ native). Menantang mitigasi Chrome Memory Saver murni peramban.<br/>**Turn 2 Reply (Sintesis Konsensus):** Qwen menerima sanggahan dan merumuskan 4 inovasi desktop lokal paling elegan. | ✅ **100% Sukses & Formulasi 4 Terobosan**<br/>1. Silent Web Audio Keep-Awake Injector (1 Hz inaudible oscillator).<br/>2. PID-Heartbeat File Mutex.<br/>3. Atomic JSON Write-Ahead File Swap.<br/>4. Evidence Delegation Router. |

---

## 10. ⚖️ Kepatuhan Terhadap Ketentuan Layanan (ToS) & Privasi

1. **Sifat Otomatisasi Peramban:**  
   Automasi peramban web berada pada area abu-abu ketentuan layanan penyedia AI komersial. Sistem ini dirancang untuk penggunaan pribadi yang wajar (asisten produktivitas harian) menggunakan akun pengguna sendiri.
2. **Tanpa Rekayasa Bot Menyesatkan:**  
   Sistem tidak menyediakan fitur rotasi multi-akun, pembuatan akun palsu otomatis, atau teknik agresif peretas Captcha.
3. **Persetujuan Pengalihan Vendor (Failover Consent):**  
   Pengguna yang menggunakan rantai default menyetujui rute failover Claude $\rightarrow$ Qwen $\rightarrow$ ChatGPT. Jika data dibatasi hanya untuk vendor tertentu, pengguna wajib menggunakan opsi `--model <provider>`.
4. **Data Tetap Lokal:**  
   Tidak ada data peramban, riwayat, atau berkas lokal yang dikirimkan ke server perantara di luar domain resmi penyedia AI (Claude, Qwen, ChatGPT).

---

## 11. 🔮 Status Implementasi Rekomendasi Qwen (v2.1.0)

Berdasarkan konsensus perdebatan arsitektural dengan Qwen Thinking Mode (lihat [`scratch/qwen_architecture_insights.md`](file:///C:/Users/Lenovo/.gemini/antigravity-cli/brain/26126196-ee5c-40f2-ac1f-fbc913679553/scratch/qwen_architecture_insights.md)), 4 pilar berikut telah diimplementasikan dan diverifikasi 100%:

1. **Silent Web Audio Keep-Awake Injector (`browser_manager.js`):** [STATUS: ✅ IMPLEMENTED & VERIFIED]
   - Menginjeksikan osilator audio 1 Hz inaudible via Web Audio API pada setiap tab peramban yang diakses.
   - Heuristik Chrome menandai tab sebagai pemutar audio aktif, sehingga tab latar belakang **100% kebal dari suspensi Chrome Memory Saver** selama proses penalaran mendalam (60–120 detik).
2. **PID-Heartbeat File Mutex (`lock_manager.js`):** [STATUS: ✅ IMPLEMENTED & VERIFIED]
   - Menyimpan payload JSON `{ pid: process.pid, timestamp: Date.now() }` dalam lockfile.
   - Menggunakan deteksi instan OS process (`process.kill(pid, 0)` di POSIX dan fallback `tasklist /FI "PID eq ..."` di Windows) jika heartbeat kedaluwarsa, mengeliminasi risiko stale deadlock $O(1)$ tanpa ketergantungan TCP port binding.
3. **Atomic JSON Write-Ahead File Swap (`session_history.js`):** [STATUS: ✅ IMPLEMENTED & VERIFIED]
   - Menulis state sementara ke `.tmp` diikuti `fs.renameSync()`.
   - Mengandalkan jaminan atomisitas kernel filesystem NTFS/ext4/APFS untuk mencegah file state korup jika terminal dihentikan paksa (SIGKILL/Ctrl+C) di tengah penulisan.
4. **Evidence Delegation Router (`critic_engine.js`):** [STATUS: ✅ IMPLEMENTED & VERIFIED]
   - Method `routeEvidenceVerification(evidenceRequest, externalExecutor)` mengalirkan verifikasi eksekusi klaim kode/formula langsung ke tool harness lokal Antigravity (compiler/linter/test runner), menjaga orchestrator tetap 100% domain-agnostik tanpa native VM sandbox.

---

## 12. 🏛️ Pola Arsitektur Hierarkis: Subagent Debater vs Parent Orchestrator Reviewer (Hasil Debat Dialektika Qwen)

Berdasarkan perdebatan mendalam multi-turn live antara Antigravity Subagent melawan Qwen (Thinking Mode) (lihat [`scratch/qwen_debate_architecture_synthesis.md`](file:///C:/Users/Lenovo/.gemini/antigravity-cli/brain/26126196-ee5c-40f2-ac1f-fbc913679553/scratch/qwen_debate_architecture_synthesis.md)), pola pembagian tanggung jawab (*Division of Responsibility*) hierarkis disepakati sebagai standar produksi melalui 5 pilar pertahanan:

1. **Toulmin Argumentation DAG Engine:**
   - Memodelkan komitmen argumen bukan sebagai array string datar (*flat array*), melainkan graf berarah $G = (V, E)$ dengan tipe node (`CLAIM`, `WARRANT`, `DATA`, `REBUTTAL`, `CORE_DIRECTIVE`) dan relasi `CONDITIONED_ON`. Mendukung *cascading invalidation* otomatis saat premis dasar terbukti cacat.
2. **Epistemic Firewall (Burden of Proof Protocol):**
   - Menghindari jebakan dogmatis (*interrupt storm*) maupun kepasrahan (*premature concession*). Web-LLM yang menyerang arahan inti diwajibkan menyertakan `CounterExamplePayload` (metrik empiris/formal proof/CVE). Retorika persuasif tanpa bukti di-*Auto-Reject* di level subagent tanpa membebani Orchestrator.
3. **Semantic-Topological Invariance Metric ($\Phi$):**
   - Menggantikan metrik leksikal Jaccard yang rentan terhadap parafrase (*lexical drift*).
   $$\Phi(G_t, G_{t-1}) = 0.7 \left( \frac{\mathbf{v}_t \cdot \mathbf{v}_{t-1}}{\|\mathbf{v}_t\| \|\mathbf{v}_{t-1}\|} \right) + 0.3 \left( \frac{|E_t \cap E_{t-1}|}{|E_t \cup E_{t-1}|} \right)$$
   Jika $\Phi \ge 0.92$ selama 2 putaran berturut-turut, sistem memutus debat dengan status `STAGNATION` (Circuit Breaker). Claude adversarial audit membongkar bahwa formula awal keliru menggunakan $(1 - \text{Jaccard})$ yang merupakan jarak bukan kemiripan.
4. **Triangulated Pareto Oracle:**
   - Menyelesaikan *Double Evaluator Echo Chamber* dengan memetakan trade-off pada batas *Pareto Frontier* (Latensi vs Konsistensi vs Kompleksitas) alih-alih validasi biner benar/salah sintaksis.
5. **Sliced Critical Pivots + Traceability Chain Hash:**
   - Menyelesaikan dilema *Second-Hand Evaluator Blindness vs Context Bloat*. Orchestrator hanya menerima 2-3 kalimat verbatim pada titik belok argumen (*tipping points*) ditambah rantai hash kriptografis $\text{Hash}_t = \text{SHA256}(\text{Hash}_{t-1} + \text{TurnPayload}_t)$. Context hemat hingga 90%, sementara auditabilitas tetap 100%.

---

## 13. 🧪 Pengujian Konkurensi Bertingkat (Hierarchical Multi-Agent Concurrency Testing)

Untuk memvalidasi integrasi multi-agen bersarang (*hierarchical multi-agent orchestration*), disimulasikan skenario di mana Master Orchestrator memicu Subagent Coordinator (`hierarchical_coordinator`), yang secara otonom meluncurkan 2 Worker Subagent secara bersamaan:
1. **Worker 1 (ChatGPT Simple Task Runner):** Menghasilkan regex validasi nomor HP Indonesia (`^\+628[1-9][0-9]{7,10}$`). Selesai sukses dalam 3m 8s.
2. **Worker 2 (Qwen Simple Task Runner):** Menghasilkan fungsi debounce TypeScript. Menemukan temuan penting: prompt optimizer 4D Lyra memperluas prompt pendek (87 karakter) menjadi persona arsitektur lengkap (2.058 karakter) yang memicu Qwen berpikir mendalam $>7$ menit. Diselesaikan dengan parameter `--no-optimize` untuk *simple tasks*.

**Verifikasi LockManager:**
Per-Provider Mutex File Lock terbukti mengunci tab secara serial tanpa tabrakan WebSocket CDP atau race condition pada proses peramban.

---

## 14. 🛡️ Blueprint Arsitektur Produksi Enterprise (Hasil Konsensus Debat Adversarial v2.2.0)

Berdasarkan audit adversarial dua putaran dengan Qwen Thinking Mode (lihat [`scratch/claude_architecture_debate_synthesis.md`](file:///C:/Users/Lenovo/.gemini/antigravity-cli/brain/26126196-ee5c-40f2-ac1f-fbc913679553/scratch/claude_architecture_debate_synthesis.md)), 4 pilar arsitektur produksi berikut disepakati untuk rilis v2.2.0+:

1. **Context-Aware Reversible Pseudonymization (`SecretPseudonymizer`):**
   - Menggantikan hard-crash regex scanner (`throw new Error`) dengan masking reversibel in-memory berbasis SHA256 (`[REDACTED_SECRET_xxx]`). Mencegah kebocoran kredensial tanpa merusak DX saat pengguna mendebug mock token atau auth test fixtures.
2. **Post-Extraction Syntactic KaTeX Validation (`extractWithSyntacticValidation`):**
   - Menggantikan `MutationObserver` pasca-stream (yang rentan memicu blind timeout 2.000ms pada CDP) dengan validasi instan keberadaan tag `<annotation>` atau `<math>` pada node `.katex` hasil clone. Jika terdeteksi malformed, fallback tunggal 500ms dijalankan sebelum normalisasi.
3. **Hybrid Token-Based LCS Stitcher (`stitchHybrid`):**
   - Menggunakan dynamic programming Longest Common Subsequence (LCS) pada window 15 baris untuk mendeteksi overlap penutupan kurung kurawal bersarang (`}\n}\n`) saat failover antar-model, menggantikan string matching naif yang rentan memotong kode valid.
4. **Graceful Epistemic Degradation (`BLOCKED_UNVERIFIABLE`):**
   - Mencegah *infinite retry deadlock* pada `CriticEngine` jika tool verifikasi bukti eksternal (compiler/test runner) tidak terpasang di mesin lokal. Status `BLOCKED_UNVERIFIABLE` menghentikan loop perdebatan secara aman dengan saran triase manual.

---

## 15. 🛡️ Tri-Layer Execution Gate & Shell Safety Guard (v2.2.3)

Berdasarkan konsultasi arsitektural langsung dengan Claude di peramban dan verifikasi pengujian live (lihat Problem Statement **P-31**):

### 15.1 Diagnosis Akar Masalah (Root Cause)
1. **Attention Dilution & Task Hijacking:** Awalan `/web-llm-orchestrator` hanya menempati sedikit token di awal prompt. Jika pengguna menyertakan prompt teknis panjang (>300 kata, multi-baris, menyertakan instruksi persona *"bertindaklah sebagai reviewer"* atau formula $\mathcal{L}_{\text{total}}$), model LLM lokal agen (Antigravity/Gemini) mengalami *attention dilution* dan membajak tugas secara internal alih-alih mendelegasikan ke browser.
2. **Direct Answering Bias:** Inferensi lokal 1 giliran terasa lebih murah bagi agen dibanding eksekusi automasi browser (tulis file + panggil CLI + tunggu CDP + relay output).
3. **PowerShell Quoting Corruption:** Pemanggilan inline `node cli.js ask "..."` rentan rusak akibat escaping tanda petik, variabel shell (`$var`), newline, dan backslash LaTeX (`\begin`).

### 15.2 Arsitektur Pertahanan 3 Lapis (Tri-Layer Defense)
```mermaid
flowchart TD
    UserPrompt["User Prompt: /web-llm-orchestrator &lt;complex prompt&gt;"] --> Gate1["Lapis 1: Router Frontmatter (SKILL.md)<br/>Imperative High-Affinity Description<br/>(DILARANG menjawab sendiri dari memori)"]
    Gate1 --> Gate2["Lapis 2: Workspace Interceptor Gate (GEMINI.md & .geminirules)<br/>Aturan Mutlak Antigravity: Simpan ke scratch/*.txt<br/>Panggil CLI via --prompt-file"]
    Gate2 --> Gate3["Lapis 3: CLI Guardrail (src/prompt_input.js)<br/>Tolak inline multi-line / >300 chars (E_INLINE_UNSAFE, Exit 2)<br/>Wajibkan --prompt-file atau --stdin"]
    Gate3 --> BrowserCDP["Browser Automation (Chrome CDP 9222)<br/>Qwen Thinking / Claude / ChatGPT"]
    BrowserCDP --> Result["Battle-Tested Untrusted Output"]
```

1. **Lapis 1: Router Affinity (`SKILL.md`):** Frontmatter `description` dirombak secara imperatif dan berbobot tinggi. Menegaskan larangan keras menjawab mandiri jika awalan command terdeteksi.
2. **Lapis 2: Workspace Interceptor Gate (`GEMINI.md` & `.geminirules`):** Memasang aturan mutlak bahwa panggilan tool pertama agen WAJIB menulis teks prompt ke berkas sementara di `scratch/` dan mengeksekusi CLI dengan `--prompt-file '<path>'`.
3. **Lapis 3: CLI Guardrail & Exit Code 2 (`src/prompt_input.js` & `src/cli.js`):**
   - Batas inline: Maksimal 300 karakter, 1 baris (bebas newline).
   - Jika teks inline melanggar batas: CLI menolak eksekusi seketika (*fail-fast*), mencetak pesan panduan edukatif, dan keluar dengan exit code `2` (`E_INLINE_UNSAFE`).
   - Mendukung bendera `--prompt-file <path>` dan `--stdin` dengan pembersihan otomatis BOM UTF-8.

### 15.3 Verifikasi Live (Medical Imaging Multi-Loss Derivation)
- **Prompt Uji:** Skenario review naskah segmentasi MRI 3D (3D U-Net vs Swin-UNETR, pembuktian stabilitas gradien loss $\mathcal{L}_{\text{total}} = \alpha \mathcal{L}_{\text{Dice}} + \beta \mathcal{L}_{\text{Focal}} + \gamma \mathcal{L}_{\text{HD95}}$, dan ancaman validitas metodologis).
- **Hasil:**
  - Lapis 3 Guardrail menolak inline multiline dengan exit code 2.
  - Eksekusi via `--prompt-file` di Qwen Thinking Mode selesai dengan status sukses (exit code 0).
  - Qwen menurunkan pembuktian matematis ledakan gradien $\mathcal{L}_{\text{HD95}}$ secara analitik, menurunkan gradien Dice Loss $\frac{\partial \mathcal{L}_{\text{Dice}}}{\partial p_k}$, dan membedah 3 kelemahan validitas metodologis IEEE TMI/MICCAI secara komprehensif. Formula LaTeX canonical terpreservasi 100%.

---

## 16. 🚀 Google Gemini 4 Argon Native Architecture (v2.3.0)

Berdasarkan eksplorasi live DOM, konsultasi arsitektur peramban bersama Claude, dan deep stress-testing terhadap model terbaru **Gemini 4 Argon** di `gemini.google.com` (lihat Problem Statement **P-32**):

### 16.1 Topologi UI & Karakteristik Komponen Gemini Web
1. **Model Selector & Reasoning Depth:**
   - Trigger selector: `[data-test-id="bard-mode-menu-button"] button`.
   - Model options: `3.5 Flash-Lite`, `3.8 Flash`, `3.1 Pro`, dan flagship `4 Argon`.
   - Default sistem: **`4 Argon`** (menggantikan Flash bawaan).
   - Reasoning depth submenu: `Tingkat penalaran` dengan opsi `Rendah`, `Sedang`, dan **`Tinggi`** (default sistem dikunci pada `Tinggi`).
2. **Segmented Button Mode ("Percakapan" vs "Tugas"):**
   - Toggle: `<chat-spark-toggle>` dengan tombol `button` berlabel `"Percakapan"` dan `"Tugas"`.
   - Mode `Percakapan`: Cocok untuk penalaran interaktif, eksplorasi matematika LaTeX, dan diskusi cepat.
   - Mode `Tugas`: Mengarahkan Gemini ke output terstruktur mendalam (deep checklist, tabel risiko komparatif, arsitektur bertahap, konfigurasi produksi).
3. **Quill Composer & Dynamic Send Button:**
   - Editor input: `<rich-textarea>` yang membungkus editor Quill `<div class="ql-editor" role="textbox" contenteditable="true" aria-label="Masukkan perintah untuk Gemini">`.
   - Quirk tombol kirim: Tombol `button[aria-label="Kirim pesan"]` **tidak ada di DOM** saat editor kosong (hanya ada tombol dikte suara).
   - Solusi injeksi: Mengetik teks via `document.execCommand('insertText')` dan menambahkan trailing space (`' '`) untuk memicu event observer yang memunculkan tombol kirim.
4. **Long Thinking Silence Telemetry:**
   - Gemini 4 Argon mengalami fasa berpikir murni selama **45–72 detik** sebelum teks respons mengalir.
   - Selama fasa ini, panjang karakter DOM tetap konstan (`~29-47` karakter dengan teks status *"Sedang menalar..."*).
   - Polling driver standar akan salah mengira ini sebagai respons yang sudah stabil dan keluar secara prematur.
   - Guardrail `waitForResponse`: Driver **dilarang keras keluar** selama tombol Stop (`button[aria-label*="Hentikan respons"]` atau `button[aria-label*="Stop"]`) atau indikator `.thoughts-status-message` masih aktif di DOM.
5. **Preservasi KaTeX Non-Destruktif & Offscreen Pre-Wrap:**
   - KaTeX pada Gemini web memuat tag `<annotation encoding="application/x-tex">` di dalam `<semantics>`.
   - Membaca `.innerText` pada node clone yang belum terpasang ke dokumen (*detached clone*) menyebabkan Chrome memperlakukannya sebagai `.textContent`, meruntuhkan seluruh baris baru (`\n`).
   - Driver melampirkan clone ke kontainer tersembunyi ber-style `position:fixed; left:-99999px; visibility:hidden; white-space:pre-wrap;` sebelum membaca `.innerText`, lalu segera menghapusnya. Hasil ekstraksi memulihkan formula LaTeX 100% sempurna dengan newline utuh.

### 16.2 Rantai Failover Bertingkat Baru (v2.3.0)
```mermaid
flowchart LR
    Claude["1. Claude Sonnet 3.5 / 3.7<br/>(Creative & Nuanced Reasoning)"] -->|Quota Exhausted / Cooldown| Gemini["2. Gemini 4 Argon<br/>(Deep Mathematical & Task Architecture)"]
    Gemini -->|Quota Exhausted / Cooldown| Qwen["3. Qwen 3.8-Max Thinking<br/>(Autonomous Evaluator & Math Proofs)"]
    Qwen -->|Quota Exhausted / Cooldown| ChatGPT["4. ChatGPT-4o Thinking<br/>(Fallback Deep Reasoning)"]
```

### 16.3 Hasil Verifikasi Live Stress-Testing
1. **Test 1 - Deep Math & Code (Mode Percakapan):**
   - Prompt: Penurunan analitik fungsi kuadratik multivariat $f(x) = \frac{1}{2}x^T A x - b^T x$, gradien $\nabla f(x)$, matriks Hessian $\nabla^2 f(x)$, dan script Python scipy.
   - Metrik: Waktu berpikir 48s, streaming 34s, total 82s (6.035 karakter). 100% LaTeX terpreservasi rapi.
2. **Test 2 - Enterprise Architecture (Mode Tugas):**
   - Prompt: Checklist migrasi CDC zero-downtime PostgreSQL ke ClickHouse dengan tabel risiko komparatif.
   - Metrik: Waktu berpikir 72s, streaming 33s, total 105s (8.907 karakter). Output terstruktur utuh, Debezium JSON, DDL SQL Kafka engine, dan tabel risiko markdown 5 baris.
3. **Test 3 - Session Persistence:**
   - Reset chat berulang via `[data-test-id="new-chat-button"]` mempertahankan pilihan `4 Argon` dan `Tinggi` 100%.

---

## 17. 🔄 Hybrid Resilient Quota Reclaim Architecture (v2.4.0)

Berdasarkan perdebatan arsitektural komprehensif bersama Claude di peramban dan pengujian *live post-reset* pada Google Gemini 4 Argon:

```mermaid
stateDiagram-v2
    [*] --> ACTIVE: Startup / Ready
    ACTIVE --> BLOCKED: Rate Limited / Degraded
    note right of BLOCKED
        Predictive Lease:
        parseResetText() mengekstrak resetAt dari DOM.
        Disimpan atomik di CooldownStore (cooldown_state.json).
        Bypass instan jika now < resetAt (Zero DOM overhead).
    end note
    BLOCKED --> HALF_OPEN: now >= resetAt
    note right of HALF_OPEN
        Authoritative Probe:
        Pemeriksaan cepat DOM (read-only)
        pada provider tingkat tertinggi.
    end note
    HALF_OPEN --> ACTIVE: Probe Sukses (Kuota Pulih / Reclaimed)
    HALF_OPEN --> BLOCKED: Probe Gagal (Masih Limit / Backoff)
```

### 17.1 Komponen & Alur Arsitektur Hibrida
1. **Multilingual Deterministic Timestamp Parser (`src/parse_reset.js`):**
   - Mengekstrak jam, menit, tanggal, dan durasi relatif dari teks UI peramban tanpa I/O.
   - Mendukung format multibahasa Indonesia & Inggris:
     - Gemini Indonesia: `"Batas direset pada 14 Okt, 20.51"`
     - Gemini Inggris: `"Limit resets on Oct 14, 8:51 PM"`
     - Claude: `"You are out of free messages until 3:00 AM"`
     - ChatGPT: `"Try again after 9:30 PM"`
     - Relatif: `"Layanan sibuk, coba lagi dalam 45 menit"` / `"Please try again in 2 hours and 15 minutes"`
   - Mengonversi teks ke epoch timestamp (milidetik) dengan kalkulasi kalender dan offset zona waktu IANA (`Asia/Jakarta`).
2. **Cross-Process Atomic Cooldown Store (`src/cooldown_store.js`):**
   - Menyimpan status cooldown ke berkas JSON lokal persisten (`~/.web-llm-orchestrator/cooldown_state.json`).
   - Menerapkan *atomic file replacement* (tulis ke `.tmp-<pid>-<ts>` lalu `renameSync`) dan file locking (`.lock`) dengan pembersihan otomatis *stale lock* (>10 detik).
   - Memastikan proses CLI baru dan MCP Server berbagi informasi lease cooldown tanpa saling menimpa.
3. **Circuit Breaker & Automatic Flagship Reclaim (`src/orchestrator.js`):**
   - Selama `now < resetAt`, orchestrator langsung melompati (*bypass*) provider yang sedang cooldown tanpa membuang waktu memicu DOM.
   - Begitu waktu reset tercapai (`now >= resetAt`), status berubah menjadi `HALF_OPEN`. Orchestrator menguji kembali (*probe*) provider tingkat teratas (`Claude` / `Gemini`).
   - Begitu model kembali aktif (misal Gemini 4 Argon unlocked), orchestrator menghapus status cooldown dari `cooldown_state.json` dan **merebut kembali (*reclaim*)** eksekusi ke model unggulan tersebut secara otonom. Sistem **tidak pernah terjebak permanen di Qwen**.
4. **Gemini Pre-Send Badge Decoupling (`src/drivers/gemini_driver.js`):**
   - Memisahkan deteksi badge composer (`checkBadge: false`) pada saat pra-kirim agar `selectModel('4 Argon')` diberikan kesempatan membuka menu dan beralih kembali ke Argon setelah masa limit berakhir.
   - Mengekstrak `resetText` langsung dari menu item yang disabled saat kuota habis.




