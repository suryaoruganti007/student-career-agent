# 🎓 CareerCraft AI – Student Career & Resume Agent

An AI-powered Student Career & Resume Intelligence web application built with **HTML, internal CSS, Vanilla JavaScript, Node.js, Express, and the OpenRouter API**.

Designed specifically for university students, new graduates, and early-career job seekers to transition smoothly from **Campus to Career**.

---

## 🌟 Key Features

1. **📄 Profile Upload & Parsing**
   - Upload resumes in **PDF, DOCX, or TXT** format, or directly paste text.
   - Built-in **1-Click Demo Profile** of a realistic CS student with internships and projects.
   - AI extracts: **Skills** (Languages, Frameworks, Tools), **Education**, **Projects**, **Certifications**, **Experience**, **Strengths**, and **Weaknesses**.

2. **🚀 Career Fit (Top 5 Best-Fit Job Roles)**
   - Recommends the student's **Top 5 Best-Fit Job Roles** ranked with match percentages.
   - Visual comparison: **Matching Skills** vs **Missing Skills / What to Learn**.
   - Custom **Learning Roadmap** with actionable milestones for each role.

3. **🎯 Job Role Checker**
   - Input any target role (e.g., `Data Analyst`, `Full Stack Developer`, `Cloud Engineer`).
   - Categorizes fit tier: **Strong Fit**, **Moderate Fit**, **Needs Improvement**, or **Poor Fit**.
   - Pinpoints critical gaps and gives a 3-step action plan to reach "Strong Fit".

4. **📋 JD Analyzer (Job Description Matcher)**
   - Paste any real job description from LinkedIn, Indeed, or company sites.
   - Calculates **ATS Compatibility Score** and identifies **Missing ATS Keywords**.
   - Highlights **Experience Gaps** and provides section-by-section suggestions on what to update.

5. **✍️ Resume Improvement Studio**
   - Generates high-impact **Headlines**, a revised **Professional Summary**, and **Skills Categorization**.
   - Rewrites project and internship bullet points using **Google's XYZ Formula**:
     > *"Accomplished [X] as measured by [Y], by doing [Z]"*
   - **Zero Hallucinations Guarantee**: Never invents false skills, companies, or achievements.

---

## 🔄 AI Workflow

```text
Upload Profile ➔ Analyze ➔ Find Best Roles ➔ Check Job Fit ➔ Compare JD ➔ Improve Resume
```

---

## 🛠️ Technology Stack

- **Frontend**: Single-file HTML5, internal Vanilla CSS3 (Custom Dark Design System with Glassmorphism and CSS variables), Vanilla JavaScript (No frameworks, zero build step).
- **Backend**: Node.js, Express.js.
- **File Parsers**: `pdf-parse` (PDF) and `mammoth` (DOCX).
- **AI Engine**: [OpenRouter API](https://openrouter.ai/) (Supports `google/gemini-2.0-flash-001`, `meta-llama/llama-3.3-70b-instruct`, etc.).
- **Deployment**: Ready for **GitHub** and **Vercel** serverless deployment.

---

## 📁 Project Structure

```text
├── index.html           # Full Single-Page Application (HTML + Internal CSS + Vanilla JS)
├── server.js            # Node.js Express server & OpenRouter API gateway
├── demo_profile.txt     # Pre-loaded realistic student demo profile
├── package.json         # Dependencies & npm scripts
├── vercel.json          # Vercel serverless deployment configuration
├── .env.example         # Environment variables template
├── .gitignore           # Git ignore rules (protects API keys & node_modules)
└── README.md            # Documentation & setup guide
```

---

## 🚀 Getting Started Locally

### 1. Prerequisites
- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher
- An **OpenRouter API Key** (from [openrouter.ai](https://openrouter.ai/keys))

### 2. Installation
Clone the repository (or extract files) and install dependencies:

```bash
cd "student-career-resume-agent"
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory (or copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` and insert your OpenRouter API Key:

```env
PORT=3000
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key-here
OPENROUTER_MODEL=google/gemini-2.0-flash-001
```

### 4. Start the Application
Run the local server:

```bash
npm start
```

Visit **`http://localhost:3000`** in your browser.

---

## ⚡ 1-Click Demo Profile Testing

1. Open `http://localhost:3000`.
2. Click the yellow **"⚡ Load Demo Profile"** button in the header or on the upload card.
3. Click **"✨ Analyze Profile with AI ➔"**.
4. Progress seamlessly through the 6-stage AI flow:
   - View extracted competencies & gaps.
   - Click **"Find My Top 5 Best-Fit Job Roles"**.
   - Check fit for `Data Analyst` or `Machine Learning Engineer`.
   - Click **"Paste Sample Data Analyst JD"** in the JD Analyzer.
   - View Google XYZ resume improvements and copy with 1-click!

---

## 🌐 Deploying to Vercel

The repository contains a pre-configured `vercel.json` file.

### Option A: Via Vercel CLI
```bash
npm i -g vercel
vercel
```
Set the environment variable when prompted:
- `OPENROUTER_API_KEY` = `sk-or-v1-...`

### Option B: Via GitHub & Vercel Dashboard
1. Push this project to your GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Student Career & Resume Agent"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/student-career-agent.git
   git push -u origin main
   ```
2. Go to [Vercel Dashboard](https://vercel.com/new).
3. Import your GitHub repository.
4. Under **Environment Variables**, add:
   - `OPENROUTER_API_KEY` = `your_openrouter_api_key`
   - `OPENROUTER_MODEL` = `google/gemini-2.0-flash-001`
5. Click **Deploy**. Vercel will build and serve your app globally.

---

## 🔒 Security Best Practices
- The **OpenRouter API Key** is strictly handled by the backend server (`server.js`) and is **never** sent to or exposed in the frontend.
- `.gitignore` ensures that `.env` and uploaded files are never committed to version control.

---

## 📄 License
MIT License. Built for students, university hackathons, and career development initiatives.
