/* ==========================================================================
   SREEDEEP.bot — CV chatbot for the 3D room intro (ES module)

   pc-intro.js puts a figurine on the desk. Clicking it calls bot.open().
   The bot runs fully in the browser. It sends nothing to any server.

   How an answer is picked:
   1. normalize() lowercases the question and rewrites tech names
      (node.js -> nodejs, c++ -> cpp, ...).
   2. If the question names a skill from SKILLS, answerSkill() replies
      (and lists the projects that use it, if the question asks for projects).
   3. If it names a tech from NOT_ON_CV, the bot says it is not on the CV.
   4. Otherwise every entry in INTENTS is scored on its phrases and keys.
      The best score above MIN_SCORE wins. Else fallback().

   The facts live in CV below. Source: Assets/Resume/SreedeepResume.pdf,
   plus the projects and dates shown on the site. Edit CV to change answers.
   ========================================================================== */

const CV = {
    name: 'Sreedeep Ghosh',
    title: 'Software Developer, AI-ML, LLM',
    location: 'Howrah, West Bengal, India',
    email: 'sreedeepghosh2005yt@gmail.com',
    linkedin: 'https://www.linkedin.com/in/sreedeep-ghosh-186b33324',
    github: 'https://github.com/sreedeepghosh2005',
    instagram: 'https://www.instagram.com/___.sreedeep.___',
    resume: 'Assets/Resume/SreedeepResume.pdf',
    summary:
        'Full-stack software developer and AI/ML enthusiast. I build web apps, interactive dashboards and ' +
        'AI/LLM-integrated features, from frontend to backend APIs to deployment. ' +
        'I have shipped real-world platforms on my own and in teams, with a strong base in machine learning, ' +
        'automation and scalable system design.',
    skillGroups: [
        { label: 'Programming languages', items: ['Python', 'Java', 'C', 'JavaScript'] },
        { label: 'Web development', items: ['React.js', 'Node.js', 'Express.js', 'REST API development', 'MongoDB', 'HTML5', 'CSS'] },
        { label: 'AI / LLM & machine learning', items: ['Machine learning', 'Deep learning', 'CNN & neural network design', 'LLM integration & prompt engineering', 'AI-assisted automation'] },
        { label: 'Data structures & algorithms', items: ['Arrays', 'Trees', 'Graphs', 'Sorting / searching', 'Complexity analysis', 'Problem solving'] },
        { label: 'Dashboard & frontend engineering', items: ['Dashboard design', 'Data visualization', 'Responsive UI development'] },
        { label: 'Tools & platforms', items: ['Git & GitHub', 'VS Code', 'Postman', 'Docker (familiar)'] },
        { label: 'Other', items: ['Data analysis & visualization', 'Automation scripting', 'Workshop facilitation'] },
    ],
    experience: [
        {
            role: 'Core Team Member — Machine Learning',
            org: 'Google Developer Group (GDG) On Campus, MCKVIE',
            when: 'Nov 2025 – present',
            points: [
                'Develop ML-driven solutions for community-focused technical challenges.',
                'Build and train ML models with Python, TensorFlow and scikit-learn.',
                'Run hands-on workshops and peer-learning sessions on AI/ML and software development.',
                'Organize outreach programs and events on Google technologies and developer best practices.',
            ],
        },
    ],
    projects: [
        {
            id: 'coding',
            name: 'Online Coding Platform (MERN)',
            keys: ['coding platform', 'online judge', 'compiler', 'code editor', 'mern', 'leetcode', 'codeforces', 'judge'],
            tech: ['React.js', 'Node.js', 'Express.js', 'MongoDB', 'JavaScript', 'REST API development'],
            points: [
                'Full-stack online coding platform with an in-browser code editor and an automated online judge that runs and grades code in real time.',
                'Secure code submission, compilation and test-case evaluation for multiple programming languages.',
                'REST APIs plus a user dashboard to track submissions, problem progress and performance analytics.',
            ],
        },
        {
            id: 'deepfake',
            name: 'Deepfake Detection',
            keys: ['deepfake', 'deep fake', 'fake image', 'manipulated media', 'xception', 'xceptionnet'],
            tech: ['Python', 'Deep learning', 'CNN & neural network design', 'TensorFlow', 'XceptionNet', 'OpenCV', 'Streamlit'],
            points: [
                'Self-trained Convolutional Neural Network (CNN) with a full image preprocessing and training pipeline.',
                'Raised real-vs-fake classification accuracy through iterative model optimization and hyperparameter tuning.',
                'Uses TensorFlow, XceptionNet and OpenCV, with a Streamlit front end.',
            ],
        },
        {
            id: 'edna',
            name: 'Taxonomy — eDNA Species Identification',
            keys: ['edna', 'dna', 'taxonomy', 'species', 'genomic', 'bioinformatics', 'biology'],
            tech: ['Python', 'Machine learning', 'Data analysis & visualization'],
            points: [
                'Machine learning model that classifies environmental DNA (eDNA) down to species level.',
                'High classification accuracy, built to handle large genomic datasets.',
            ],
        },
        {
            id: 'water',
            name: 'DWLR / GWLR — Water Level Detection & Trend Prediction',
            keys: ['dwlr', 'gwlr', 'water', 'groundwater', 'water level', 'forecast', 'forecasting', 'time series', 'timeseries'],
            tech: ['Python', 'Machine learning', 'Data analysis & visualization', 'scikit-learn', 'Pandas'],
            points: [
                'Real-time water-level monitoring system covering multiple regions across India.',
                'Time-series forecasting models predict future water-level trends.',
                'Built with Python, scikit-learn and Pandas.',
            ],
        },
        {
            id: 'notes',
            name: 'Decenter Notes',
            keys: ['decenter', 'decentralized', 'decentralised', 'blockchain', 'solidity', 'web3', 'notes app', 'smart contract'],
            tech: ['Blockchain', 'Solidity', 'Web3', 'React.js'],
            points: [
                'Decentralized note-taking platform with secure, immutable storage on the blockchain.',
                'Built with Solidity, Web3 and React.',
            ],
        },
    ],
    education: [
        { what: 'B.Tech in Information Technology', where: 'MCKV Institute of Engineering (MCKVIE), Howrah', when: '2024 – 2028', detail: 'Currently in 3rd year. 1st year GPA: 8.34. 2nd year GPA: 8.4.' },
        { what: 'Class 12 (ISC, Science with Computer Science)', where: "St. Mary's Convent School", when: '2024', detail: 'Score: 80.75%.' },
        { what: 'Class 10 (ICSE)', where: "St. Mary's Convent School", when: '2022', detail: 'Score: 89%.' },
    ],
};

/* ---- Skills the bot can answer "do you know X?" about ----------------- */
// name: shown in the answer. group: CV skill group. aliases: normalized tokens or phrases.
const SKILLS = [
    { name: 'Python', group: 'Programming languages', aliases: ['python', 'py'] },
    { name: 'Java', group: 'Programming languages', aliases: ['java'] },
    { name: 'C', group: 'Programming languages', aliases: ['c language', 'c programming', 'in c', 'know c', 'use c'] },
    { name: 'JavaScript', group: 'Programming languages', aliases: ['javascript', 'js', 'ecmascript'] },
    { name: 'React.js', group: 'Web development', aliases: ['react', 'reactjs'] },
    { name: 'Node.js', group: 'Web development', aliases: ['nodejs', 'node'] },
    { name: 'Express.js', group: 'Web development', aliases: ['express', 'expressjs'] },
    { name: 'MongoDB', group: 'Web development', aliases: ['mongodb', 'mongo', 'nosql'] },
    { name: 'REST API development', group: 'Web development', aliases: ['rest', 'restful', 'api', 'apis', 'backend api'] },
    { name: 'HTML5', group: 'Web development', aliases: ['html', 'html5'] },
    { name: 'CSS', group: 'Web development', aliases: ['css', 'css3', 'css5'] },
    { name: 'CNN & neural network design', group: 'AI / LLM & machine learning', aliases: ['cnn', 'neural network', 'neural networks', 'convolutional'] },
    { name: 'LLM integration & prompt engineering', group: 'AI / LLM & machine learning', aliases: ['llm', 'llms', 'prompt engineering', 'prompt', 'gpt', 'chatgpt', 'genai', 'generative ai', 'large language model'] },
    { name: 'AI-assisted automation', group: 'AI / LLM & machine learning', aliases: ['automation', 'automate'] },
    { name: 'TensorFlow', group: 'AI / LLM & machine learning', aliases: ['tensorflow', 'tf', 'keras'] },
    { name: 'scikit-learn', group: 'AI / LLM & machine learning', aliases: ['scikit', 'sklearn', 'scikit learn'] },
    { name: 'OpenCV', group: 'AI / LLM & machine learning', aliases: ['opencv', 'computer vision', 'cv2'] },
    { name: 'Pandas', group: 'Other', aliases: ['pandas'] },
    { name: 'Streamlit', group: 'Other', aliases: ['streamlit'] },
    { name: 'Dashboard design & data visualization', group: 'Dashboard & frontend engineering', aliases: ['dashboard', 'dashboards', 'data visualization', 'visualization', 'visualisation', 'charts'] },
    { name: 'Git & GitHub', group: 'Tools & platforms', aliases: ['git', 'github', 'version control'] },
    { name: 'VS Code', group: 'Tools & platforms', aliases: ['vscode', 'vs code', 'visual studio code'] },
    { name: 'Postman', group: 'Tools & platforms', aliases: ['postman'] },
    { name: 'Docker (familiar)', group: 'Tools & platforms', aliases: ['docker', 'container', 'containers'] },
    { name: 'Blockchain', group: 'Projects', aliases: ['blockchain'] },
    { name: 'Solidity', group: 'Projects', aliases: ['solidity'] },
    { name: 'Web3', group: 'Projects', aliases: ['web3'] },
];

// Common tech that is not on the CV. The bot says so plainly instead of guessing.
const NOT_ON_CV = [
    ['cpp', 'C++'], ['csharp', 'C#'], ['rust', 'Rust'], ['golang', 'Go'], ['kotlin', 'Kotlin'], ['swift', 'Swift'],
    ['php', 'PHP'], ['ruby', 'Ruby'], ['typescript', 'TypeScript'], ['angular', 'Angular'], ['vue', 'Vue'],
    ['nextjs', 'Next.js'], ['django', 'Django'], ['flask', 'Flask'], ['fastapi', 'FastAPI'], ['spring', 'Spring'],
    ['pytorch', 'PyTorch'], ['aws', 'AWS'], ['azure', 'Azure'], ['gcp', 'Google Cloud'], ['kubernetes', 'Kubernetes'],
    ['mysql', 'MySQL'], ['postgres', 'PostgreSQL'], ['postgresql', 'PostgreSQL'], ['sql', 'SQL'], ['firebase', 'Firebase'],
    ['flutter', 'Flutter'], ['android', 'Android'], ['figma', 'Figma'], ['tailwind', 'Tailwind CSS'], ['linux', 'Linux'],
    ['redis', 'Redis'], ['graphql', 'GraphQL'], ['unity', 'Unity'], ['matlab', 'MATLAB'], ['r language', 'R'],
];

/* ---- Text helpers ------------------------------------------------------ */
const STOP = new Set(('a an the is are am was were be been do does did have has had i me my you your yours u ur he his him she her ' +
    'it its of in on at to for from with and or but so if as by about tell please can could would will shall should may ' +
    'what which who whom whose how why when where any some all this that these those there here just also really very ' +
    'know give show list share let us we our sir maam bro mr').split(' '));

function normalize(text) {
    return ` ${text.toLowerCase()} `
        .replace(/c\+\+/g, ' cpp ')
        .replace(/c#/g, ' csharp ')
        .replace(/\bnode\.?js\b/g, ' nodejs ')
        .replace(/\breact\.?js\b/g, ' react ')
        .replace(/\bexpress\.?js\b/g, ' express ')
        .replace(/\bnext\.?js\b/g, ' nextjs ')
        .replace(/\bvue\.?js\b/g, ' vue ')
        .replace(/\bgo ?lang\b/g, ' golang ')
        .replace(/\bb\.? ?tech\b/g, ' btech ')
        .replace(/\bc\.?g\.?p\.?a\b/g, ' cgpa ')
        .replace(/\bx(ii|2)?th\b|\bclass ?(10|x)\b/g, (m) => (/(ii|2|12)/.test(m) ? ' class12 ' : ' class10 '))
        .replace(/\bclass ?(12|xii)\b|\b12th\b/g, ' class12 ')
        .replace(/\b10th\b/g, ' class10 ')
        .replace(/[^a-z0-9#+\s]/g, ' ')
        .replace(/\s+/g, ' ');
}

const stem = (w) => (w.length > 4 ? w.replace(/(ies)$/, 'y').replace(/(ing|ed|es|s)$/, '') : w);

function tokens(norm) {
    return norm.trim().split(' ').filter((w) => w && !STOP.has(w)).map(stem);
}

function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 3;
    const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let prev = dp[0];
        dp[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = dp[j];
            dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = tmp;
        }
    }
    return dp[b.length];
}

// 1 for an exact token match, 0.7 for a close typo, else 0.
function tokenMatch(tok, key) {
    if (tok === key) return 1;
    if (tok.length >= 5 && key.length >= 5) {
        const d = lev(tok, key);
        if (d === 1 || (d === 2 && tok.length >= 8)) return 0.7;
    }
    return 0;
}

const hasPhrase = (norm, p) => norm.includes(` ${p} `);

/* ---- Answer builders (HTML from fixed data only, never from user text) -- */
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const link = (href, label) => `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;

function projectCard(p) {
    return `<b>${esc(p.name)}</b>${ul(p.points.map(esc))}<span class="cvb-tags">${p.tech.map((t) => `<i>${esc(t)}</i>`).join('')}</span>`;
}

function answerSkill(skill, wantsProjects) {
    const used = CV.projects.filter((p) => p.tech.some((t) => t.toLowerCase() === skill.name.toLowerCase()));
    const where = skill.group === 'Projects'
        ? 'I have used it in a project.'
        : `It is on my CV under <b>${esc(skill.group)}</b>.`;
    if (wantsProjects) {
        if (!used.length) return `${esc(skill.name)} is one of my skills, but no single project on my CV is built around it.`;
        return `Projects where I used <b>${esc(skill.name)}</b>:${ul(used.map((p) => esc(p.name)))}`;
    }
    const usedLine = used.length ? ` I used it in: ${used.map((p) => esc(p.name)).join(', ')}.` : '';
    return `Yes. ${where}${usedLine}`;
}

const contactHtml = () => ul([
    `Email: ${link(`mailto:${CV.email}`, CV.email)}`,
    `LinkedIn: ${link(CV.linkedin, 'sreedeep-ghosh')}`,
    `GitHub: ${link(CV.github, 'sreedeepghosh2005')}`,
    `Instagram: ${link(CV.instagram, '@___.sreedeep.___')}`,
    `Résumé (PDF): ${link(CV.resume, 'download')}`,
]);

const SUGGEST = ['Skills', 'Projects', 'Education', 'Experience', 'Contact'];

/* ---- Intents ----------------------------------------------------------- */
// phrases: matched on the normalized text (score 2.5 each). keys: matched per token (score 1 each).
// weight multiplies the score, to break ties toward more specific intents.
const INTENTS = [
    {
        id: 'greet', weight: 0.9,
        phrases: ['good morning', 'good evening', 'good afternoon', 'whats up'],
        keys: ['hi', 'hello', 'hey', 'hii', 'hiii', 'yo', 'sup', 'namaste', 'hola', 'greeting'],
        answer: () => `Hey! I'm mini-${esc(CV.name.split(' ')[0])}. Ask me anything about my CV: skills, projects, education, experience or how to reach me.`,
        chips: SUGGEST,
    },
    {
        id: 'bot', weight: 1.1,
        phrases: ['are you real', 'are you a bot', 'are you ai', 'how do you work', 'what are you', 'who made you', 'who built you'],
        keys: ['bot', 'chatbot', 'robot', 'figurine'],
        answer: () => 'I am a small chatbot inside this 3D room. I answer only from my CV. I run in your browser and send nothing to any server.',
    },
    {
        id: 'about', weight: 1,
        phrases: ['who are you', 'about you', 'about yourself', 'introduce yourself', 'your background', 'who is sreedeep'],
        keys: ['introduce', 'introduction', 'summary', 'background', 'profile', 'yourself', 'sreedeep', 'overview', 'bio'],
        answer: () => `I'm <b>${esc(CV.name)}</b>, ${esc(CV.title)}. ${esc(CV.summary)} I'm a 3rd-year B.Tech IT student at MCKV Institute of Engineering.`,
        chips: ['Skills', 'Projects', 'Contact'],
    },
    {
        id: 'skills', weight: 1,
        phrases: ['tech stack', 'what can you do', 'good at', 'skill set', 'what do you know'],
        keys: ['skill', 'skillset', 'stack', 'tech', 'technology', 'technologies', 'tool', 'expertise', 'proficient', 'competence', 'abilities', 'strong'],
        answer: () => `My technical skills:${ul(CV.skillGroups.map((g) => `<b>${esc(g.label)}:</b> ${g.items.map(esc).join(', ')}`))}`,
        chips: ['AI / ML', 'Web dev', 'Projects'],
    },
    {
        id: 'langs', weight: 1.15,
        phrases: ['programming language', 'programming languages', 'coding language', 'languages do you', 'which language'],
        keys: ['language', 'languages'],
        answer: () => 'I code in <b>Python, Java, C and JavaScript</b>.',
    },
    {
        id: 'web', weight: 1.1,
        phrases: ['full stack', 'fullstack', 'web development', 'web dev', 'front end', 'back end'],
        keys: ['web', 'frontend', 'backend', 'mern', 'website', 'fullstack'],
        answer: () => `Web development: ${CV.skillGroups[1].items.map(esc).join(', ')}. ` +
            `Plus dashboard design, data visualization and responsive UI.<br>My biggest web project is the <b>Online Coding Platform (MERN)</b>.`,
        chips: ['Coding platform', 'Projects'],
    },
    {
        id: 'ai', weight: 1.1,
        phrases: ['machine learning', 'deep learning', 'artificial intelligence', 'ai ml', 'ai and ml', 'neural network'],
        keys: ['ai', 'ml', 'aiml', 'llm', 'cnn', 'model', 'models', 'intelligence', 'tensorflow'],
        answer: () => `AI / ML is my main focus. ${CV.skillGroups[2].items.map(esc).join(', ')}.` +
            `<br>ML projects: Deepfake Detection (CNN), eDNA species classification and water-level forecasting (DWLR/GWLR).`,
        chips: ['Deepfake', 'eDNA', 'Water level'],
    },
    {
        id: 'dsa', weight: 1.1,
        phrases: ['data structures', 'problem solving', 'competitive programming'],
        keys: ['dsa', 'algorithm', 'algorithms', 'leetcode', 'codeforces', 'codechef', 'competitive'],
        answer: () => `DSA on my CV: ${CV.skillGroups[3].items.map(esc).join(', ')}.`,
    },
    {
        id: 'tools', weight: 1.05,
        phrases: ['tools do you use', 'dev tools'],
        keys: ['tools', 'git', 'docker', 'postman', 'vscode', 'ide'],
        answer: () => `Tools: ${CV.skillGroups[5].items.map(esc).join(', ')}.`,
    },
    {
        id: 'projects', weight: 1,
        phrases: ['what have you built', 'what did you build', 'your work', 'side projects', 'selected works'],
        keys: ['project', 'projects', 'built', 'build', 'made', 'portfolio', 'work', 'works', 'created', 'develop', 'developed'],
        answer: () => `Projects on my CV:${ul(CV.projects.map((p) => `<b>${esc(p.name)}</b> — ${esc(p.points[0])}`))}Ask about any one for details.`,
        chips: ['Coding platform', 'Deepfake', 'eDNA', 'Water level', 'Decenter Notes'],
    },
    ...CV.projects.map((p) => ({
        id: `project-${p.id}`, weight: 1.4,
        phrases: p.keys.filter((k) => k.includes(' ')),
        keys: p.keys.filter((k) => !k.includes(' ')),
        answer: () => projectCard(p),
    })),
    {
        id: 'experience', weight: 1.05,
        phrases: ['work experience', 'job experience', 'google developer', 'developer group', 'gdg on campus'],
        keys: ['experience', 'experienced', 'gdg', 'google', 'club', 'community', 'role', 'position', 'workshop', 'workshops', 'team', 'member', 'lead', 'volunteer'],
        answer: (q) => {
            const e = CV.experience[0];
            const intern = /\bintern/.test(q) ? 'No internship is listed on my CV yet. My experience so far:<br>' : '';
            return `${intern}<b>${esc(e.role)}</b><br>${esc(e.org)} · ${esc(e.when)}${ul(e.points.map(esc))}`;
        },
    },
    {
        id: 'internship', weight: 1.2,
        phrases: [],
        keys: ['internship', 'internships', 'intern'],
        answer: () => {
            const e = CV.experience[0];
            return `No internship is listed on my CV yet. My experience so far: <b>${esc(e.role)}</b> at ${esc(e.org)} (${esc(e.when)}).`;
        },
    },
    {
        id: 'education', weight: 1,
        phrases: ['where do you study', 'where did you study', 'which college', 'what do you study'],
        keys: ['education', 'educational', 'study', 'studying', 'college', 'university', 'degree', 'btech', 'qualification', 'academic', 'academics', 'student', 'mckv', 'mckvie', 'school', 'year', 'semester', 'sem'],
        answer: () => `Education:${ul(CV.education.map((e) => `<b>${esc(e.what)}</b> — ${esc(e.where)} (${esc(e.when)}). ${esc(e.detail)}`))}`,
    },
    {
        id: 'grades', weight: 1.25,
        phrases: ['how much did you score', 'what did you score', 'your marks'],
        keys: ['gpa', 'cgpa', 'sgpa', 'ygpa', 'grade', 'grades', 'marks', 'score', 'scored', 'percentage', 'percent', 'result', 'results', 'pointer'],
        answer: () => ul([
            'B.Tech IT: 1st year GPA <b>8.34</b>, 2nd year GPA <b>8.4</b>',
            'Class 12 (ISC): <b>80.75%</b>',
            'Class 10 (ICSE): <b>89%</b>',
        ]),
    },
    {
        id: 'school', weight: 1.3,
        phrases: ['high school', 'higher secondary'],
        keys: ['class10', 'class12', 'icse', 'isc', 'board', 'boards', 'secondary', 'mary', 'convent'],
        answer: () => `School: St. Mary's Convent School.${ul([
            'Class 12 (ISC, Science with Computer Science), 2024: <b>80.75%</b>',
            'Class 10 (ICSE), 2022: <b>89%</b>',
        ])}`,
    },
    {
        id: 'contact', weight: 1.1,
        phrases: ['get in touch', 'reach you', 'contact you', 'talk to you', 'phone number', 'mobile number'],
        keys: ['contact', 'email', 'mail', 'gmail', 'reach', 'phone', 'number', 'call', 'linkedin', 'github', 'instagram', 'insta', 'social', 'socials', 'connect', 'message', 'dm', 'whatsapp'],
        answer: () => `Reach me here:${contactHtml()}My phone number is in the résumé PDF.`,
    },
    {
        id: 'resume', weight: 1.2,
        phrases: ['download cv', 'download resume'],
        keys: ['resume', 'cv', 'pdf', 'download'],
        answer: () => `Here is my résumé: ${link(CV.resume, 'SreedeepResume.pdf')}. Or just ask me about any part of it.`,
    },
    {
        id: 'location', weight: 1.1,
        phrases: ['where are you from', 'where do you live', 'where are you based', 'which city'],
        keys: ['location', 'located', 'live', 'city', 'based', 'hometown', 'howrah', 'kolkata', 'bengal', 'india', 'relocate'],
        answer: () => `I'm based in <b>${esc(CV.location)}</b>.`,
    },
    {
        id: 'hire', weight: 1.1,
        phrases: ['open to work', 'looking for', 'can we hire', 'are you available', 'job opportunity'],
        keys: ['hire', 'hiring', 'available', 'availability', 'opportunity', 'opportunities', 'freelance', 'recruit', 'job', 'jobs', 'offer', 'collaborate', 'collaboration'],
        answer: () => `Yes, I'm available and open to opportunities.${contactHtml()}`,
    },
    {
        id: 'why', weight: 1.1,
        phrases: ['why should we hire', 'why hire', 'what makes you', 'stand out', 'your strengths', 'best at'],
        keys: ['strength', 'strengths', 'unique', 'special', 'different', 'achievement', 'achievements', 'accomplishment', 'proud'],
        answer: () => ul([
            'Full-stack <b>and</b> AI/ML: I can ship the web app and the model behind it.',
            'Shipped a full MERN online judge with real-time code execution.',
            'Trained my own CNN for deepfake detection, plus eDNA and water-level forecasting models.',
            'Core ML team member at GDG On Campus; I run workshops and peer-learning sessions.',
            'Consistent grades: B.Tech GPA 8.34 → 8.4.',
        ]),
    },
    {
        id: 'thanks', weight: 0.9,
        phrases: ['thank you', 'thanks a lot', 'that helps'],
        keys: ['thanks', 'thank', 'thx', 'ty', 'cool', 'nice', 'great', 'awesome', 'ok', 'okay'],
        answer: () => 'Happy to help! Anything else about my CV?',
        chips: SUGGEST,
    },
    {
        id: 'bye', weight: 0.9,
        phrases: ['see you', 'good bye'],
        keys: ['bye', 'goodbye', 'cya'],
        answer: () => 'Bye! Click the monitor to enter the full site.',
    },
    {
        id: 'help', weight: 1,
        phrases: ['what can i ask', 'what can you answer', 'what do you do'],
        keys: ['help', 'options', 'menu', 'commands'],
        answer: () => 'Ask me about my skills, projects, education, grades, experience, location, or how to contact me.',
        chips: SUGGEST,
    },
];

// Short labels used by the suggestion chips, sent as questions.
const CHIP_QUESTIONS = {
    'Skills': 'What are your skills?',
    'Projects': 'What projects have you built?',
    'Education': 'Tell me about your education',
    'Experience': 'What is your experience?',
    'Contact': 'How can I contact you?',
    'AI / ML': 'Tell me about your AI and ML skills',
    'Web dev': 'Tell me about your web development skills',
    'Coding platform': 'Tell me about the online coding platform',
    'Deepfake': 'Tell me about the deepfake detection project',
    'eDNA': 'Tell me about the eDNA taxonomy project',
    'Water level': 'Tell me about the DWLR water level project',
    'Decenter Notes': 'Tell me about Decenter Notes',
};

// One exact keyword (score 0.9+) or one close typo (0.7) is enough.
const MIN_SCORE = 0.7;
const PROJECT_WORDS = /\b(project|projects|built|build|made|used|use|using)\b/;

function prepIntent(it) {
    return { ...it, stemKeys: it.keys.map(stem) };
}
const PREPPED = INTENTS.map(prepIntent);

export function reply(question) {
    const norm = normalize(question);
    const toks = tokens(norm);
    if (!toks.length && !norm.trim()) return { html: 'Type a question about my CV.', chips: SUGGEST };

    // A named project beats a named skill ("tell me about the deepfake project").
    const projectHit = PREPPED.filter((it) => it.id.startsWith('project-'))
        .find((it) => it.phrases.some((p) => hasPhrase(norm, p)) || toks.some((t) => it.stemKeys.some((k) => tokenMatch(t, k) === 1)));

    if (projectHit && !/\b(projects|all)\b/.test(norm)) return { html: projectHit.answer(norm) };

    if (!projectHit) {
        const skill = SKILLS.find((s) => s.aliases.some((a) => hasPhrase(norm, a)));
        // Yes/no style ("do you know react?") or a bare skill name ("python").
        const asksSkill = /\b(do you|can you|have you|are you|know|knows|familiar|use|used|using|worked|proficient|comfortable)\b/.test(norm)
            || toks.length <= 1;
        if (skill && asksSkill) return { html: answerSkill(skill, PROJECT_WORDS.test(norm) && /\bproject/.test(norm)) };

        const missing = NOT_ON_CV.find(([alias]) => hasPhrase(norm, alias));
        if (missing) {
            return { html: `${esc(missing[1])} is not on my CV. My stack is Python, Java, C, JavaScript, React, Node.js, Express, MongoDB, and ML/deep learning.`, chips: ['Skills'] };
        }
    }

    let best = null;
    let bestScore = 0;
    for (const it of PREPPED) {
        let s = 0;
        for (const p of it.phrases) if (hasPhrase(norm, p)) s += 2.5;
        for (const t of toks) {
            let m = 0;
            for (const k of it.stemKeys) m = Math.max(m, tokenMatch(t, k));
            s += m;
        }
        s *= it.weight;
        if (s > bestScore) { bestScore = s; best = it; }
    }
    if (best && bestScore >= MIN_SCORE) return { html: best.answer(norm), chips: best.chips };
    return fallback();
}

function fallback() {
    return {
        html: "I only know what's on my CV, and I couldn't match that question. Try asking about my skills, projects, education, experience or contact details.",
        chips: SUGGEST,
    };
}

/* ---- Chat panel UI ----------------------------------------------------- */
// mount: element to put the panel in. onOpenChange(open), onTalk(talking): hooks for the 3D figurine.
export function createCvBot({ mount, onOpenChange = () => {}, onTalk = () => {} }) {
    const panel = document.createElement('section');
    panel.className = 'cvb';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chat with mini-Sreedeep about the CV');
    panel.hidden = true;
    panel.innerHTML = `
        <header class="cvb-head">
            <span class="cvb-dot" aria-hidden="true"></span>
            <span class="cvb-title">SREEDEEP.bot<small>// ASK ME ABOUT MY CV</small></span>
            <button class="cvb-close" type="button" aria-label="Close chat">✕</button>
        </header>
        <div class="cvb-log" aria-live="polite"></div>
        <div class="cvb-chips"></div>
        <form class="cvb-form" autocomplete="off">
            <input class="cvb-input" type="text" maxlength="300" placeholder="Ask about skills, projects, education…" aria-label="Your question">
            <button class="cvb-send" type="submit" aria-label="Send">➤</button>
        </form>`;
    mount.appendChild(panel);

    const log = panel.querySelector('.cvb-log');
    const chipsEl = panel.querySelector('.cvb-chips');
    const form = panel.querySelector('.cvb-form');
    const input = panel.querySelector('.cvb-input');
    let isOpen = false;
    let busy = false;
    let greeted = false;

    function addMsg(who, content, isHtml) {
        const m = document.createElement('div');
        m.className = `cvb-msg cvb-${who}`;
        if (isHtml) m.innerHTML = content;
        else m.textContent = content;
        log.appendChild(m);
        log.scrollTop = log.scrollHeight;
        return m;
    }

    function setChips(list) {
        chipsEl.innerHTML = '';
        (list || []).forEach((label) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'cvb-chip';
            b.textContent = label;
            b.addEventListener('click', () => ask(CHIP_QUESTIONS[label] || label));
            chipsEl.appendChild(b);
        });
    }

    function botSay(res) {
        busy = true;
        onTalk(true);
        const typing = addMsg('bot', '<span class="cvb-typing"><i></i><i></i><i></i></span>', true);
        const delay = 380 + Math.min(res.html.length, 700) * 0.9;
        setTimeout(() => {
            typing.innerHTML = res.html;
            log.scrollTop = log.scrollHeight;
            setChips(res.chips || []);
            busy = false;
            setTimeout(() => onTalk(false), 900);
        }, delay);
    }

    function ask(text) {
        const q = text.trim();
        if (!q || busy) return;
        addMsg('user', q, false);
        setChips([]);
        botSay(reply(q));
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        ask(input.value);
        input.value = '';
    });
    panel.querySelector('.cvb-close').addEventListener('click', () => close());
    // Keys typed in the chat must not reach the room's Enter / Space / Esc handlers.
    panel.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') close();
    });

    function open() {
        if (isOpen) return;
        isOpen = true;
        panel.hidden = false;
        requestAnimationFrame(() => panel.classList.add('is-open'));
        onOpenChange(true);
        if (!greeted) {
            greeted = true;
            botSay({
                html: `Hi! I'm mini-Sreedeep 👋 I know everything on my CV. What would you like to know?`,
                chips: SUGGEST,
            });
        }
        if (matchMedia('(hover: hover) and (pointer: fine)').matches) setTimeout(() => input.focus(), 50);
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        panel.classList.remove('is-open');
        input.blur();
        setTimeout(() => { if (!isOpen) panel.hidden = true; }, 250);
        onOpenChange(false);
    }

    return {
        open,
        close,
        toggle: () => (isOpen ? close() : open()),
        get isOpen() { return isOpen; },
    };
}
