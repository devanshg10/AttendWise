# AttendWise — Smart Attendance & Bunk Calculator

A modern, responsive, frontend-only web application designed for university students to track class attendance, compute safe bunk thresholds, and forecast recovery trajectories.

![AttendWise Preview](https://img.shields.io/badge/Status-Complete-success?style=for-the-badge) ![Frontend](https://img.shields.io/badge/Tech-HTML5%20%7C%20CSS3%20%7C%20Vanilla%20JS-indigo?style=for-the-badge) ![Deployment](https://img.shields.io/badge/Deploy-Vercel%20Static-black?style=for-the-badge)

---

## 🌟 Key Features

### 1. 📊 Executive Dashboard
- **Instant Attendance Health**: Live KPI cards for Overall Attendance Percentage, Total Attended Classes, and Missed Classes.
- **Dynamic Subject Comparison Chart**: Responsive bar chart rendered using Chart.js, color-coded by health status.
- **Quick Bunk Cushion Summary**: Immediate readout of permissible absences per course.
- **Enrolled Subjects Quick-Action Grid**: Log attendance directly with single-click "Attended" or "Missed" stepper buttons.
- **Critical Threshold Banner**: Automatic warning banner whenever any enrolled subject drops below the requirement.

### 2. 🧮 Scientifically Accurate Bunk Calculator
- **Permissible Bunk Formula**:
  $$\text{Safe Bunks} = \max\left(0, \left\lfloor \frac{A}{P} - T \right\rfloor\right)$$
  Where $A$ is Attended Classes, $T$ is Total Classes Held, and $P$ is target percentage expressed as a decimal ($0.75$ for $75\%$).
- **Consecutive Recovery Catch-up Formula**:
  $$\text{Required Classes } (x) = \left\lceil \frac{P \times T - A}{1 - P} \right\rceil$$
  Finds the minimum consecutive non-negative integer of future classes needed to satisfy $\frac{A + x}{T + x} \ge P$.
- **Custom What-If Simulator**: Load any existing course or test hypothetical scenarios with interactive sliders and circular SVG progress rings.
- **Full Matrix Table**: Complete cross-subject breakdown of bunk limits and recovery paths.

### 3. 📚 Comprehensive Subject Management
- **Full CRUD Support**: Add, Edit, Delete, and adjust attendance records.
- **Multi-field Metadata**: Stores Course Name, Instructor/Professor Name, Attended Classes, Total Held Classes, and custom Target %.
- **Input Validation**: Strict client-side guards preventing negative numbers or attended counts exceeding total classes held.
- **Manual Adjustments**: Dedicated modal to safely recalibrate attendance totals without deleting the course.

### 4. 🔍 Search, Filter & Sorters
- **Live Search**: Instant keyword search matching subject names and professor names.
- **Status Filter**: Filter courses by `Safe`, `At Risk (Borderline)`, or `Below Target`.
- **Dynamic Sorters**: Sort by Alphabetical (A-Z / Z-A), Attendance Percentage (Lowest or Highest First), or Total Classes Held.

### 5. 💾 Zero-Backend Data Portability & Persistence
- **Local Persistence**: Automatically synchronizes state changes to browser `localStorage`.
- **JSON Export**: Download complete attendance archives, settings, and logs as structured JSON backups.
- **JSON Import**: Upload and restore previous backups with rigorous schema validation.
- **Activity & Audit Log**: Real-time chronological timeline tracking attendance increments, modifications, and deletes.
- **Demo Data & Hard Reset**: Easily load sample university data or purge all records with modal confirmations.

### 6. 🎨 Design & Accessibility
- Clean white and soft-slate aesthetics with Indigo (`#6366f1`) and Violet (`#8b5cf6`) brand gradients.
- Light and Dark Theme support with persistent storage.
- Lucide SVG icons and fluid typography (`Inter` & `Plus Jakarta Sans`).
- Mobile-first responsive drawer sidebar and touch-friendly controls.

---

## 🛠️ Technology Stack
- **HTML5**: Semantic tags, accessible attributes, and responsive layout.
- **CSS3**: CSS Custom Properties (variables), Flexbox, CSS Grid, smooth transitions, and dark mode theming.
- **Vanilla JavaScript (ES6+)**: Zero frameworks, modular structure, strict mathematical calculations, and zero build steps.
- **Chart.js CDN**: Lightweight dynamic visualization for subject attendance comparison.
- **Lucide Icons CDN**: Crisp SVG iconography.

---

## 🚀 How to Run Locally

Because AttendWise is built entirely with vanilla web technologies, there are **no dependencies to install** and **no build steps required**.

### Option A: Open directly in your browser
Simply double-click `index.html` or open it directly in Google Chrome, Brave, Safari, Edge, or Firefox:
```bash
open index.html # On macOS
```

### Option B: Use a local development server (Recommended)
You can use Python or Node to serve the static files:

**Using Python 3:**
```bash
python3 -m http.server 3000
```
Then navigate to: `http://localhost:3000`

**Using Node `npx serve`:**
```bash
npx serve .
```

---

## 🗄️ How localStorage Works

AttendWise stores all user data directly inside the client's web browser using `window.localStorage`.
1. **Keys Used**:
   - `attendwise_subjects_v1`: Array of course objects with names, faculty, attendance counts, and target percentages.
   - `attendwise_settings_v1`: Object containing global targets and risk buffers.
   - `attendwise_activity_v1`: Array of timestamped activity events.
   - `attendwise_theme_v1`: Current theme preference (`"light"` or `"dark"`).
2. **Zero Cloud Telemetry**: No personal identifiable data, passwords, or metrics are ever sent to any external server.
3. **Backup Mechanism**: The Export feature compiles all keys into a single JSON file that you can store on your machine or transfer across devices using the Import feature.

---

## ☁️ How to Deploy to Vercel

AttendWise is 100% static and requires zero build scripts, making deployment to Vercel instantaneous.

### Method 1: Using the Vercel CLI
1. Install Vercel CLI (if not already installed):
   ```bash
   npm i -g vercel
   ```
2. Run the deploy command inside this repository:
   ```bash
   vercel
   ```
3. Follow the CLI prompts:
   - Set project name (e.g. `attendwise`)
   - Directory: `./` (current directory)
   - Build command: None (leave blank / default)
   - Output directory: None (leave blank / default)
4. Your site will immediately be live on a `*.vercel.app` URL!

### Method 2: Via Git Repository on Vercel Dashboard
1. Push this directory to your GitHub / GitLab / Bitbucket repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of AttendWise"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
2. Log into [vercel.com](https://vercel.com) and click **"Add New..."** > **"Project"**.
3. Import your repository.
4. Leave Framework Preset as **Other** or **Static HTML**.
5. Click **Deploy**. Vercel will host your site across its global Edge CDN in seconds.

---

## 📄 License
MIT License. Free for students and educators.
