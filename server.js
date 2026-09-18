const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(__dirname));

// Multer memory storage for file uploads (serverless and Vercel compatible)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper to call OpenRouter API with retry/fallback
async function callOpenRouter(systemPrompt, userPrompt, temperature = 0.3) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
    throw new Error('OPENROUTER_API_KEY is not configured in .env');
  }

  const primaryModel = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct';
  const fallbackModels = [
    primaryModel,
    'meta-llama/llama-3.3-70b-instruct',
    'deepseek/deepseek-chat',
    'mistralai/mistral-small-24b-instruct-2501',
    'google/gemini-2.0-flash-exp:free'
  ];

  // Try models with fallback
  let lastError = null;
  const modelsToTry = [...new Set(fallbackModels)];

  for (const model of modelsToTry) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'HTTP-Referer': 'https://student-career-agent.local',
          'X-Title': 'Student Career and Resume Agent',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: temperature,
          max_tokens: 3000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Model ${model} failed with HTTP ${response.status}: ${errorText}`);
        lastError = new Error(`OpenRouter API error (${model} - HTTP ${response.status}): ${errorText}`);
        continue; // try next fallback model
      }

      const data = await response.json();
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response structure received from OpenRouter API');
      }

      const rawContent = data.choices[0].message.content.trim();
      return parseJsonResponse(rawContent);
    } catch (err) {
      console.warn(`Error using model ${model}:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to obtain response from OpenRouter');
}

// Clean and extract valid JSON from LLM markdown codeblocks or raw text
function parseJsonResponse(rawText) {
  let cleaned = rawText.trim();
  // Strip ```json ... ``` or ``` ... ``` wrappers
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  // Attempt direct JSON parse
  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    // Look for first '{' and last '}'
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const sub = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(sub);
      } catch (e2) {
        // Look for array '[' to ']'
        const firstArr = cleaned.indexOf('[');
        const lastArr = cleaned.lastIndexOf(']');
        if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
          const arrSub = cleaned.substring(firstArr, lastArr + 1);
          return JSON.parse(arrSub);
        }
      }
    }
    console.error('Failed to parse JSON response. Raw string was:\n', rawText);
    throw new Error('AI response was not valid JSON: ' + e1.message);
  }
}

// -------------------------------------------------------------
// ROUTES
// -------------------------------------------------------------

// 1. Health check & configuration status
app.get('/api/health', (req, res) => {
  const hasKey = Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your_openrouter_api_key_here');
  res.json({
    status: 'ok',
    configured: hasKey,
    model: process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001'
  });
});

// 2. Demo Profile retrieval
app.get('/api/demo-profile', (req, res) => {
  try {
    const demoPath = path.join(__dirname, 'demo_profile.txt');
    if (fs.existsSync(demoPath)) {
      const text = fs.readFileSync(demoPath, 'utf8');
      res.json({ success: true, text });
    } else {
      res.status(404).json({ error: 'Demo profile file not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Extract Text from PDF, DOCX, or TXT upload
app.post('/api/extract-text', upload.single('file'), async (req, res) => {
  try {
    if (req.body.text && req.body.text.trim()) {
      return res.json({ success: true, text: req.body.text.trim() });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file or text provided' });
    }

    const { originalname, buffer } = req.file;
    const ext = path.extname(originalname).toLowerCase();
    let extractedText = '';

    if (ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      extractedText = data.text;
    } else if (ext === '.docx' || ext === '.doc') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer: buffer });
      extractedText = result.value;
    } else if (ext === '.txt') {
      extractedText = buffer.toString('utf8');
    } else {
      return res.status(400).json({ error: 'Unsupported file format. Please upload PDF, DOCX, or TXT.' });
    }

    if (!extractedText.trim()) {
      return res.status(400).json({ error: 'The uploaded file appears to be empty or contains non-extractable text.' });
    }

    res.json({
      success: true,
      filename: originalname,
      text: extractedText.trim()
    });
  } catch (err) {
    console.error('File extraction error:', err);
    res.status(500).json({ error: 'Failed to extract text from document: ' + err.message });
  }
});

// 4. Feature 1: Profile Upload & Comprehensive Analysis
app.post('/api/analyze-profile', async (req, res) => {
  try {
    const { profileText } = req.body;
    if (!profileText || !profileText.trim()) {
      return res.status(400).json({ error: 'Profile text is required' });
    }

    const systemPrompt = `You are an expert AI Career Coach and Technical Recruiter for university students and early-career job seekers.
Analyze the candidate's resume/profile thoroughly and extract key structured information.
CRITICAL: Respond ONLY with valid, RFC 8259 compliant JSON. Do not include introductory or concluding conversational text.

Return a JSON object exactly matching this structure:
{
  "name": "Full Name or Candidate",
  "contact": {
    "email": "email if found or null",
    "phone": "phone if found or null",
    "linkedin": "linkedin or null",
    "github": "github or null",
    "location": "location or null"
  },
  "education": [
    {
      "institution": "University/College",
      "degree": "Degree name & major",
      "graduation": "Year or expected graduation",
      "gpa": "GPA or null",
      "coursework": ["Course 1", "Course 2"]
    }
  ],
  "technical_skills": {
    "languages": ["Python", "JavaScript", ...],
    "frameworks": ["React", "Node.js", ...],
    "databases_and_tools": ["PostgreSQL", "Docker", "Git", ...],
    "other": ["REST APIs", "Agile", ...]
  },
  "soft_skills": ["Problem Solving", "Team Leadership", ...],
  "projects": [
    {
      "title": "Project Name",
      "technologies": ["Tech 1", "Tech 2"],
      "description": "Short summary of project scope",
      "highlights": ["Key achievement or metric 1", "Key achievement 2"]
    }
  ],
  "experience": [
    {
      "role": "Job/Internship Title",
      "company": "Company Name",
      "duration": "Dates or period",
      "highlights": ["Responsibility or accomplishment 1", "Responsibility 2"]
    }
  ],
  "certifications": [
    {
      "title": "Certification Name",
      "issuer": "Issuing Org",
      "year": "Year or Status"
    }
  ],
  "strengths": [
    "Identified competitive advantage or standout capability 1",
    "Standout capability 2",
    "Standout capability 3"
  ],
  "weaknesses": [
    "Identified skill gap or resume deficiency 1",
    "Skill gap 2",
    "Skill gap 3"
  ],
  "overall_summary": "A 2-3 sentence executive recruiter summary of the student's profile and readiness."
}`;

    const userPrompt = `Here is the student's resume/profile:\n\n${profileText}`;
    const result = await callOpenRouter(systemPrompt, userPrompt, 0.2);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Analyze profile error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Feature 2: Career Fit (Top 5 Best-Fit Job Roles)
app.post('/api/career-fit', async (req, res) => {
  try {
    const { profileText, profileData } = req.body;
    if (!profileText && !profileData) {
      return res.status(400).json({ error: 'Profile data or text is required' });
    }

    const context = profileText || JSON.stringify(profileData);

    const systemPrompt = `You are a high-level Career Path Strategist for tech and corporate roles.
Evaluate the student's background, coursework, projects, internships, and skill levels.
Identify the student's TOP 5 BEST-FIT JOB ROLES for entry-level / new-grad or internship hiring.
CRITICAL: Respond ONLY with valid, RFC 8259 compliant JSON.

Return a JSON object formatted exactly as:
{
  "roles": [
    {
      "rank": 1,
      "role_name": "Job Role Title (e.g. Junior Full-Stack Developer)",
      "match_percentage": 92,
      "category": "Software Engineering | Data & AI | Cloud & DevOps | Product/Design | Cybersecurity",
      "why_fit": "Clear 2-sentence explanation of why the student is well-suited based on their projects and experience.",
      "matching_skills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4"],
      "missing_skills": ["Missing Skill 1", "Missing Skill 2", "Missing Skill 3"],
      "what_to_learn": [
        "Concrete milestone 1 with recommended tool or resource",
        "Concrete milestone 2",
        "Concrete milestone 3"
      ],
      "estimated_readiness": "Immediate / 1-2 Months of Targeted Prep / 3-6 Months"
    }
  ]
}
Ensure exactly 5 distinct roles ranked from highest to lowest match percentage.`;

    const userPrompt = `Student Profile:\n\n${context}`;
    const result = await callOpenRouter(systemPrompt, userPrompt, 0.3);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Career fit error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Feature 3: Job Role Checker
app.post('/api/job-role-checker', async (req, res) => {
  try {
    const { profileText, targetRole } = req.body;
    if (!profileText || !targetRole) {
      return res.status(400).json({ error: 'Both profileText and targetRole are required' });
    }

    const systemPrompt = `You are a senior technical hiring manager conducting a Job Role Readiness assessment.
The student wants to know how well they qualify for the specific target role: "${targetRole}".
Determine their fit tier:
- "Strong Fit" (Match >= 80%)
- "Moderate Fit" (Match 60% - 79%)
- "Needs Improvement" (Match 40% - 59%)
- "Poor Fit" (Match < 40%)

CRITICAL: Respond ONLY with valid, RFC 8259 compliant JSON.
Return JSON with this structure:
{
  "target_role": "${targetRole}",
  "fit_tier": "Strong Fit | Moderate Fit | Needs Improvement | Poor Fit",
  "match_percentage": 82,
  "fit_badge_color": "green | blue | amber | red",
  "verdict_summary": "2-3 sentences providing an honest, encouraging recruiter perspective on this candidate for ${targetRole}.",
  "matching_skills": ["Skill 1", "Skill 2", "Skill 3"],
  "missing_skills": ["Skill 1", "Skill 2", "Skill 3"],
  "experience_alignment": "Analysis of whether their internships/projects align with ${targetRole} standards.",
  "strengths_for_role": ["Strength 1", "Strength 2"],
  "critical_gaps": ["Gap 1", "Gap 2"],
  "action_plan": [
    {
      "step": 1,
      "title": "Action Title",
      "detail": "Actionable task to bridge this gap immediately"
    },
    {
      "step": 2,
      "title": "Action Title",
      "detail": "Actionable task to bridge this gap"
    },
    {
      "step": 3,
      "title": "Action Title",
      "detail": "Actionable task to bridge this gap"
    }
  ]
}`;

    const userPrompt = `Target Role: ${targetRole}\n\nStudent Profile:\n${profileText}`;
    const result = await callOpenRouter(systemPrompt, userPrompt, 0.2);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Job role checker error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7. Feature 4: JD Analyzer (Job Description Matcher)
app.post('/api/jd-analyzer', async (req, res) => {
  try {
    const { profileText, jobDescription } = req.body;
    if (!profileText || !jobDescription) {
      return res.status(400).json({ error: 'Both profileText and jobDescription are required' });
    }

    const systemPrompt = `You are an Applicant Tracking System (ATS) algorithm and Lead Recruiter simulator.
Compare the student's profile against the pasted Job Description.
Provide a comprehensive ATS and human recruiter gap analysis.
CRITICAL: Respond ONLY with valid, RFC 8259 compliant JSON.

Return JSON in this format:
{
  "match_percentage": 78,
  "ats_compatibility_rating": "High | Moderate | Low",
  "key_findings_summary": "Concise summary of candidate's alignment with this specific opening.",
  "matching_skills": ["Skill A", "Skill B", "Skill C"],
  "missing_skills": ["Skill X", "Skill Y"],
  "missing_keywords": ["Keyword/Concept 1", "Keyword 2", "Tool 3"],
  "experience_gaps": "Detailed explanation of any years of experience, specific domain context, or tooling missing in the candidate's profile.",
  "what_to_update_in_resume": [
    {
      "section": "Headline / Summary / Projects / Skills / Experience",
      "recommendation": "Specific change to tailor the resume for this JD",
      "suggested_bullet_or_phrase": "Concrete example phrasing to use"
    }
  ],
  "interview_readiness_tip": "One key talking point the student should prepare to address gaps during an interview."
}`;

    const userPrompt = `JOB DESCRIPTION:\n${jobDescription}\n\n---\n\nSTUDENT PROFILE / RESUME:\n${profileText}`;
    const result = await callOpenRouter(systemPrompt, userPrompt, 0.2);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('JD analyzer error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 8. Feature 5: Resume Improvement Studio
app.post('/api/resume-improvement', async (req, res) => {
  try {
    const { profileText, targetRole } = req.body;
    if (!profileText) {
      return res.status(400).json({ error: 'Profile text is required' });
    }

    const systemPrompt = `You are an elite Resume Strategist and Career Counselor who helps students land FAANG, Fortune 500, and top startup offers.
Analyze the student's profile and provide tangible, section-by-section improvements.

STRICT INTEGRITY RULE: NEVER invent, hallucinate, or fabricate unearned credentials, fake companies, exaggerated metrics, non-existent certifications, or skills the student did not mention. All improvements must genuinely represent the candidate's actual work, elevated with powerful action verbs, clear problem-solution framing, and quantifiable Google XYZ structure ("Accomplished [X] as measured by [Y], by doing [Z]").

CRITICAL: Respond ONLY with valid, RFC 8259 compliant JSON.

Return JSON structure:
{
  "headline_suggestions": [
    "Headline option 1 (Concise, role-targeted, skill-focused)",
    "Headline option 2 (Value-proposition focused)",
    "Headline option 3 (Academic & project-driven)"
  ],
  "summary_revision": {
    "critique": "What is weak or missing in their current summary or intro.",
    "improved_summary": "Polished, compelling 3-4 sentence professional summary tailored for hiring managers."
  },
  "skills_optimization": {
    "formatting_tip": "How to reorganize skills to pass ATS filters cleanly.",
    "categorized_layout": {
      "Languages": "...",
      "Frameworks & Libraries": "...",
      "Cloud & Databases": "...",
      "Developer Tools": "..."
    }
  },
  "project_enhancements": [
    {
      "project_title": "Project Name from profile",
      "original_feel": "Weaknesses in how it was originally stated (e.g. passive tone, lacking metrics)",
      "improved_bullets": [
        "Accomplished [X] by doing [Z], resulting in [Y metric or performance outcome]",
        "Architected [...] using [...] ensuring [...]"
      ]
    }
  ],
  "experience_enhancements": [
    {
      "role_and_company": "Role @ Company from profile",
      "improved_bullets": [
        "Enhanced bullet 1 with strong impact verb and context",
        "Enhanced bullet 2"
      ]
    }
  ],
  "recruiter_checklist": [
    "High priority polish point 1",
    "High priority polish point 2",
    "High priority polish point 3"
  ]
}`;

    const userPrompt = `Target Role (if any): ${targetRole || 'Software / Tech Entry Level'}\n\nCandidate Resume:\n${profileText}`;
    const result = await callOpenRouter(systemPrompt, userPrompt, 0.3);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Resume improvement error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Catch-all route to serve index.html for client-side navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start local server if run directly
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` Student Career & Resume Agent Backend`);
    console.log(` Server running at: http://localhost:${PORT}`);
    console.log(` OpenRouter Model:  ${process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001'}`);
    console.log(` API Key Status:    ${process.env.OPENROUTER_API_KEY ? 'Configured' : 'Missing'}`);
    console.log(`====================================================`);
  });
}

// Export for Vercel serverless functions
module.exports = app;
