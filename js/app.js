/* ==================== LUNARA APP ==================== */

const AppState = {
    user: null, isPremium: false, language: 'en', theme: 'light',
    messagesToday: 0, messageLimit: 3, currentScreen: 'onboarding',
    previousScreen: null, todayLog: null, logs: [], chatHistory: [], onboardingStep: 1,
    isAuthenticated: false, userProfile: null
};

const Storage = {
    get(key) { try { return JSON.parse(localStorage.getItem('lunara_' + key)); } catch(e) { return null; } },
    set(key, value) { localStorage.setItem('lunara_' + key, JSON.stringify(value)); },
    clear() { Object.keys(localStorage).forEach(k => { if(k.startsWith('lunara_')) localStorage.removeItem(k); }); }
};

// ==================== SYMPTOM LOG MODULE ====================
// Modular helpers for symptom log storage and recommendation context.
// Designed to be extended for Premium features (trend analysis, viewed-article
// tracking, repetition avoidance, personalised insights with chat history).
const SymptomLog = {
    save(log) {
        try {
            if (!log || typeof log.date !== 'string') return;
            const snapshot = {
                date: log.date,
                timestamp: Date.now(),
                symptoms: Object.assign({}, log.symptoms || {})
            };
            Storage.set('latestSymptomLog', snapshot);
        } catch(e) {}
    },
    getLatest() {
        try {
            const data = Storage.get('latestSymptomLog');
            if (!data || typeof data !== 'object' || typeof data.date !== 'string' || typeof data.symptoms !== 'object') return null;
            return data;
        } catch(e) { return null; }
    },
    getTopSymptoms(minScore, limit) {
        minScore = typeof minScore === 'number' ? minScore : 3;
        limit = typeof limit === 'number' ? limit : 2;
        const log = this.getLatest();
        if (!log || typeof log.symptoms !== 'object') return [];
        return Object.entries(log.symptoms)
            .filter(function(pair) { return typeof pair[1] === 'number' && pair[1] >= minScore; })
            .sort(function(a, b) { return b[1] - a[1]; })
            .slice(0, limit)
            .map(function(pair) { return pair[0]; });
    }
};

function init() {
    const saved = Storage.get('state');
    if (saved) { Object.assign(AppState, saved); applyTheme(); applyLanguage(); 
        if (AppState.user) { showMainApp(); renderHome(); } else { showOnboarding(); }
    } else { showOnboarding(); }
    const lastReset = Storage.get('lastReset');
    const today = new Date().toDateString();
    if (lastReset !== today) { AppState.messagesToday = 0; Storage.set('lastReset', today); Storage.set('state', AppState); }
    setupEventListeners(); generateInitialData();
}

function generateInitialData() {
    if (!Storage.get('logs') || Storage.get('logs').length === 0) {
        const logs = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            logs.push({ date: d.toISOString().split('T')[0], mood: Math.floor(Math.random()*3)+2, sleep: Math.floor(Math.random()*5)+4, stress: Math.floor(Math.random()*3)+1, water: Math.floor(Math.random()*4)+3, symptoms: {} });
        }
        Storage.set('logs', logs); AppState.logs = logs;
    } else { AppState.logs = Storage.get('logs'); }
}

function navigateTo(screenId) {
    AppState.previousScreen = AppState.currentScreen;
    AppState.currentScreen = screenId;
    Storage.set('state', AppState);
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) { target.classList.add('active'); target.scrollTop = 0; }
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.target === screenId));
    if (screenId === 'home') renderHome();
    if (screenId === 'tracker') renderTracker();
    if (screenId === 'insights') renderInsights();
    if (screenId === 'daily-plan') renderDailyPlan();
    if (screenId === 'community') renderCommunity('stories');
    if (screenId === 'education') renderEducation('all');
    if (screenId === 'chat') { maybeInjectSymptomRecommendation(); renderChat(); }
    if (screenId === 'settings') renderSettings();
    if (screenId === 'profile') renderProfile();
}

function showMainApp() { document.getElementById('onboarding').classList.add('hidden'); document.getElementById('main-app').classList.remove('hidden'); document.getElementById('bottom-nav').classList.remove('hidden'); }
function showOnboarding() { document.getElementById('onboarding').classList.remove('hidden'); document.getElementById('main-app').classList.add('hidden'); document.getElementById('bottom-nav').classList.add('hidden'); }

let onboardingData = { age: '', symptoms: [], goals: [], sleep: 3, stress: 3, gp: '' };
function nextOnboardingStep() {
    const current = document.querySelector('.onboarding-step:not(.hidden)');
    const step = parseInt(current.dataset.step);
    
    if (step === 2 && !onboardingData.age) { shakeElement(current); return; }
    if (step === 3 && onboardingData.symptoms.length === 0) { shakeElement(current); return; }
    if (step === 4 && onboardingData.goals.length === 0) { shakeElement(current); return; }
    
    if (step === 5) {
        const sleepSlider = document.getElementById('ob-sleep');
        const stressSlider = document.getElementById('ob-stress');
        const gpToggle = document.querySelector('.ob-toggle.selected');
        if (sleepSlider) onboardingData.sleep = parseInt(sleepSlider.value);
        if (stressSlider) onboardingData.stress = parseInt(stressSlider.value);
        if (gpToggle) onboardingData.gp = gpToggle.dataset.value;
    }
    
    current.classList.add('hidden');
    const next = document.querySelector('.onboarding-step[data-step="' + (step+1) + '"]');
    if (next) { next.classList.remove('hidden'); AppState.onboardingStep = step+1; }
}

function finishOnboarding() {
    const sleepSlider = document.getElementById('ob-sleep');
    const stressSlider = document.getElementById('ob-stress');
    const gpToggle = document.querySelector('.ob-toggle.selected');
    if (sleepSlider) onboardingData.sleep = parseInt(sleepSlider.value);
    if (stressSlider) onboardingData.stress = parseInt(stressSlider.value);
    if (gpToggle) onboardingData.gp = gpToggle.dataset.value;
    
    AppState.user = { name: 'Beautiful', age: onboardingData.age, symptoms: onboardingData.symptoms, goals: onboardingData.goals, joined: new Date().toISOString() };
    AppState.isAuthenticated = true;
    AppState.userProfile = { 
        name: 'Beautiful', 
        email: 'user@example.com', 
        joinDate: new Date(), 
        articlesRead: 0, 
        checkInsCompleted: 0, 
        savedArticles: 0, 
        streak: 1 
    };
    Storage.set('state', AppState); Storage.set('user', AppState.user);
    showMainApp(); renderHome();
    AppState.chatHistory = [{ from: 'luna', text: getText({ en: "Welcome to Lunara. I am Luna, and I am here to walk beside you through this. There is no rush, no judgment, and no such thing as a silly question. How are you feeling today?", ar: "مرحبًا بك في لونارا. أنا لونا، وأنا هنا لأمشي بجانبك. لا عجلة، لا حكم، وليس هناك سؤال سخيف. كيف تشعرين اليوم؟" }), time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) }];
    Storage.set('chatHistory', AppState.chatHistory);
}

function shakeElement(el) { el.style.animation = 'none'; el.offsetHeight; el.style.animation = 'shake 0.4s ease'; }

document.addEventListener('click', (e) => {
    if (e.target.closest('.age-options .ob-option')) { 
        document.querySelectorAll('.age-options .ob-option').forEach(btn => btn.classList.remove('selected')); 
        const btn = e.target.closest('.age-options .ob-option');
        btn.classList.add('selected');
        onboardingData.age = btn.dataset.value;
        setTimeout(() => nextOnboardingStep(), 300);
    }
    if (e.target.closest('.symptom-options .ob-option')) { 
        const btn = e.target.closest('.symptom-options .ob-option'); 
        btn.classList.toggle('selected'); 
        const val = btn.dataset.value; 
        if (btn.classList.contains('selected')) { 
            if (!onboardingData.symptoms.includes(val)) onboardingData.symptoms.push(val); 
        } else { 
            onboardingData.symptoms = onboardingData.symptoms.filter(s => s !== val); 
        }
    }
    if (e.target.closest('.goal-options .ob-option')) { 
        const btn = e.target.closest('.goal-options .ob-option'); 
        btn.classList.toggle('selected'); 
        const val = btn.dataset.value; 
        if (btn.classList.contains('selected')) { 
            if (!onboardingData.goals.includes(val)) onboardingData.goals.push(val); 
        } else { 
            onboardingData.goals = onboardingData.goals.filter(g => g !== val); 
        }
    }
    if (e.target.closest('.ob-toggle')) { 
        const btn = e.target.closest('.ob-toggle'); 
        btn.parentElement.querySelectorAll('.ob-toggle').forEach(b => b.classList.remove('selected')); 
        btn.classList.add('selected');
        onboardingData.gp = btn.dataset.value;
    }
});

// ==================== ARTICLES DATA WITH IMAGES ====================
const articles = [
    { id: 1, filter: 'all', title: { en: 'The Three Stages of Menopause, Gently Explained', ar: 'المراحل الثلاث لانقطاع الطمث، موضحة بلطف' }, readTime: '4 min', featured: true, imageUrl: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=800&h=450&fit=crop', author: 'Dr. Emma Walsh', publishDate: '2024-03-15',
      content: { en: '<div class="article-body"><p>Menopause is not a single event. It is a journey with three phases, and understanding them can help you feel less alone.</p><p><strong>Perimenopause (the early stage):</strong> This usually starts in your 40s. Your ovaries are gradually reducing oestrogen and progesterone. Your cycle may become irregular — sometimes months pass, sometimes weeks apart. Brain fog, mood swings, and sleep disruption often start here.</p><p><strong>Menopause (the milestone):</strong> Officially, you have reached menopause when you have not had a period for 12 consecutive months. It is a moment in time, not a state.</p><p><strong>Postmenopause:</strong> Everything after that 12-month mark. Some symptoms ease, but others — like vaginal dryness or joint pain — may linger.</p><p>You are not going mad. Your body is simply adjusting to a new chapter.</p></div>', ar: '<div class="article-body"><p>انقطاع الطمث ليس حدثًا واحدًا. إنها رحلة بثلاث مراحل.</p></div>' }},
    { id: 2, filter: 'peri', title: { en: 'Why Brain Fog Is Real & What Helps', ar: 'لماذا ضباب الدماغ حقيقي (وما يساعد)' }, readTime: '5 min', imageUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&h=450&fit=crop', author: 'Dr. Sarah Chen', publishDate: '2024-03-10',
      content: { en: '<div class="article-body"><p>Brain fog is one of the most isolating symptoms because no one else can see it. You can see a hot flash coming, but brain fog creeps up quietly.</p><p><strong>The science:</strong> Oestrogen supports acetylcholine, a neurotransmitter crucial for memory and focus. When oestrogen drops, so does acetylcholine. Your brain is not broken — it is recalibrating.</p><p><strong>What helps:</strong><ul><li>Sleep: Non-negotiable. Your brain consolidates memories during sleep.</li><li>Protein: Amino acids support neurotransmitter production.</li><li>Movement: Even a 20-minute walk increases blood flow to your brain.</li><li>Hydration: Dehydration worsens brain fog instantly.</li></ul></p></div>', ar: '' }},
    { id: 3, filter: 'menopause', title: { en: 'Hot Flushes: The Science of Sudden Heat', ar: 'الهبات الساخنة: علم الحرارة المفاجئة' }, readTime: '3 min', imageUrl: 'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&h=450&fit=crop', author: 'Dr. James Miller', publishDate: '2024-03-05',
      content: { en: '<div class="article-body"><p>A hot flash does not come from nowhere. It is a predictable response from your hypothalamus.</p><p><strong>What is happening:</strong> Your hypothalamus — your internal thermostat — becomes oversensitive during menopause. A tiny rise in core temperature (sometimes just 0.5°C) triggers a full cooling response: sweating, flushing, heart racing.</p><p><strong>Why it feels worse at night:</strong> Core body temperature naturally rises in the evening. For many women, this is when hot flashes strike.</p><p><strong>What helps:</strong> Layers you can remove, cool water nearby, regular exercise, and good sleep hygiene.</p></div>', ar: '' }},
    { id: 4, filter: 'peri', title: { en: 'Rebuilding Sleep When Hormones Shift', ar: 'إعادة بناء النوم عندما تتغير الهرمونات' }, readTime: '4 min', imageUrl: 'https://images.unsplash.com/photo-1531512073830-ba890ca4eba2?w=800&h=450&fit=crop', author: 'Dr. Lisa Wong', publishDate: '2024-02-28',
      content: { en: '<div class="article-body"><p>Sleep disruption is one of the cruellest symptoms because everything feels harder without rest. Progesterone, which helps us feel sleepy, is dropping. Cortisol, which should be lowest at night, is often elevated.</p><p><strong>Small changes that work:</strong><ul><li>Consistency: Same bedtime, same wake time, even weekends.</li><li>Cool, dark room: Aim for 16–19°C.</li><li>No screens after 8pm: Blue light suppresses melatonin.</li><li>Magnesium: Consider a spray or bath salt.</li></ul></p></div>', ar: '' }},
    { id: 5, filter: 'post', title: { en: 'Nutrition After 40: The Quiet Upgrade', ar: 'التغذية بعد 40: الترقية الهادئة' }, readTime: '4 min', imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=450&fit=crop', author: 'Dr. Amanda Roberts', publishDate: '2024-02-20',
      content: { en: '<div class="article-body"><p>Your body needs different fuel now. Metabolism has slowed, but nutrient needs have climbed.</p><p><strong>Protein matters more:</strong> Aim for 25–30g per meal. It preserves muscle, stabilizes blood sugar, and supports mood.</p><p><strong>Healthy fats are not the enemy:</strong> Olive oil, avocado, nuts, and fatty fish support hormone production and brain health.</p><p><strong>Iron and B vitamins:</strong> Many women become anaemic after significant blood loss stops. Get levels checked.</p></div>', ar: '' }},
    { id: 6, filter: 'all', title: { en: 'Hormone Changes & Emotional Wellbeing', ar: 'تغييرات الهرمونات والرفاهية العاطفية' }, readTime: '5 min', imageUrl: 'https://images.unsplash.com/photo-1477332552946-cfb384aeaf1c?w=800&h=450&fit=crop', author: 'Dr. Rachel Green', publishDate: '2024-02-15',
      content: { en: '<div class="article-body"><p>The emotional symptoms of menopause are not just "in your head" — they are firmly rooted in biochemistry.</p><p><strong>Why mood shifts happen:</strong> Oestrogen affects serotonin production. When oestrogen fluctuates, so does your neurotransmitter balance.</p><p><strong>What to expect:</strong> Anxiety, depression, irritability, and emotional intensity are all common and treatable.</p></div>', ar: '' }},
    { id: 7, filter: 'post', title: { en: 'Strength Training After 40', ar: 'تمارين القوة بعد 40' }, readTime: '6 min', imageUrl: 'https://images.unsplash.com/photo-1552258297-4a6b2db18264?w=800&h=450&fit=crop', author: 'Coach Maria Santos', publishDate: '2024-02-10',
      content: { en: '<div class="article-body"><p>Strength training is not just for young people. After 40, it becomes even more important for bone health, metabolism, and mood.</p><p><strong>Why it matters:</strong> Oestrogen decline accelerates bone loss. Strength training builds and maintains bone density naturally.</p><p><strong>Getting started:</strong> Begin with 2-3 sessions per week. Focus on compound movements that engage multiple muscle groups.</p></div>', ar: '' }}
];

function renderHome() {
    const user = AppState.user || { name: 'Beautiful' };
    document.querySelector('.user-name').textContent = user.name;
    const logs = Storage.get('logs') || [];
    const today = new Date().toISOString().split('T')[0];
    const todayLog = logs.find(l => l.date === today);
    let score = 50;
    let message = getText({ en: "Today asks for gentleness. Rest is productive too.", ar: "اليوم يطلب اللطف. الراحة إنتاجية أيضًا." });
    let hormoneMsg = getText({ en: "Tracking your patterns...", ar: "تتبع أنماطك..." });
    if (todayLog) {
        score = calculateWellnessScore(todayLog);
        message = getWellnessMessage(score, todayLog);
        hormoneMsg = getHormoneInsight(todayLog);
        document.getElementById('stat-sleep').textContent = todayLog.sleep + 'h';
        document.getElementById('stat-mood').textContent = todayLog.mood + '/5';
        document.getElementById('stat-stress').textContent = todayLog.stress + '/5';
        document.getElementById('stat-water').textContent = todayLog.water + ' glasses';
    } else {
        document.getElementById('stat-sleep').textContent = '--';
        document.getElementById('stat-mood').textContent = '--';
        document.getElementById('stat-stress').textContent = '--';
        document.getElementById('stat-water').textContent = '--';
    }
    document.getElementById('wellness-score').textContent = score;
    document.getElementById('wellness-message').textContent = message;
    document.getElementById('hormone-insight').textContent = hormoneMsg;
}

function calculateWellnessScore(log) {
    let score = 50;
    score += (log.mood - 3) * 8;
    score += (log.sleep - 5) * 4;
    score -= (log.stress - 3) * 8;
    score += (log.water - 5) * 2;
    const symptomTotal = Object.values(log.symptoms || {}).reduce((a, b) => a + b, 0);
    score -= symptomTotal * 2;
    return Math.max(0, Math.min(100, Math.round(score)));
}

function getWellnessMessage(score, log) {
    const messages = { 
        en: ["Today asks for gentleness. Rest is productive too.", "Your body is doing important work. Be patient with it.", "A softer day is still a good day. You are enough.", "Small steps forward count.", "You are doing better than you think.", "This transition is temporary. You will find your rhythm."],
        ar: ["اليوم يطلب اللطف. الراحة إنتاجية أيضًا.", "جسدك يقوم بعمل مهم. كن صبورًا معه.", "اليوم الأكثر ليونة هو يوم جيد. أنت كاف.", "الخطوات الصغيرة للأمام تحسب.", "أنت تفعل أفضل مما تعتقد.", "هذا الانتقال مؤقت. ستجدين إيقاعك."]
    };
    return messages[AppState.language][Math.min(Math.floor(score / 20), 5)];
}

function getHormoneInsight(log) {
    const insights = { 
        en: ["Oestrogen naturally lower this week — expect softer energy in the afternoons.", "Your cortisol pattern suggests a gentle morning walk would help today.", "Progesterone is rising — your body may crave extra rest this week.", "Peak oestrogen week — your energy and mood are likely at their best.", "Rising FSH suggests your body is working hard. Extra hydration helps.", "Cortisol is dipping — this is a good day for restorative practices."],
        ar: ["الإستروجين طبيعيًا أقل هذا الأسبوع — توقعي طاقة أكثر ليونة بعد الظهر.", "يشير نمط الكورتيزول إلى أن مشية صباحية لطيفة ستساعد اليوم.", "يرتفع البروجسترون — قد يرغب جسدك في راحة إضافية هذا الأسبوع.", "أسبوع ذروة الإستروجين — طاقتك ومزاجك على الأرجح في أفضل حالاتهما.", "يشير FSH المرتفع إلى أن جسدك يعمل بجد. الترطيب الإضافي يساعد.", "الكورتيزول ينخفض — هذا يوم جيد للممارسات التصالحية."]
    };
    return insights[AppState.language][Math.floor(Math.random() * insights[AppState.language].length)];
}

const symptomConfig = [
    { id: 'hot-flashes-night-sweats', label: { en: 'Hot flashes and night sweats', ar: 'الهبات الساخنة والتعرق الليلي' } },
    { id: 'sleep-problems', label: { en: 'Sleep problems', ar: 'مشاكل النوم' } },
    { id: 'brain-fog-memory', label: { en: 'Brain fog and poor memory', ar: 'ضباب الدماغ وضعف الذاكرة' } },
    { id: 'mood-changes-irritability', label: { en: 'Mood changes and irritability', ar: 'تغيرات المزاج والتهيج' } },
    { id: 'anxiety', label: { en: 'Anxiety', ar: 'القلق' } },
    { id: 'fatigue-exhaustion', label: { en: 'Fatigue and exhaustion', ar: 'الإرهاق والتعب الشديد' } },
    { id: 'joint-muscle-aches', label: { en: 'Joint and muscle aches', ar: 'آلام المفاصل والعضلات' } },
    { id: 'headaches', label: { en: 'Headaches', ar: 'الصداع' } },
    { id: 'weight-gain', label: { en: 'Weight gain', ar: 'زيادة الوزن' } },
    { id: 'vaginal-dryness', label: { en: 'Vaginal dryness', ar: 'جفاف المهبل' } }
];

const symptomMigrationMap = {
    'hot-flashes': 'hot-flashes-night-sweats',
    'sleep-issues': 'sleep-problems',
    'brain-fog': 'brain-fog-memory',
    'mood-swings': 'mood-changes-irritability',
    'fatigue': 'fatigue-exhaustion'
};

// ==================== LEARN RECOMMENDATIONS ====================
// Maps symptom IDs to article IDs in the articles array.
// Using IDs (not titles) means recommendations stay correct if titles change.
const SYMPTOM_ARTICLE_MAP = {
    'hot-flashes-night-sweats': 3,
    'sleep-problems': 4,
    'brain-fog-memory': 2,
    'mood-changes-irritability': 6,
    'anxiety': 6,
    'fatigue-exhaustion': 5,
    'joint-muscle-aches': 7,
    'headaches': 1,
    'weight-gain': 5,
    'vaginal-dryness': 1
};

// Returns up to `symptomIds.length` real Learn article titles for the given symptom IDs.
// Titles are read from the articles array at call-time, so they stay current automatically.
function getLearnRecommendations(symptomIds) {
    if (!Array.isArray(symptomIds) || symptomIds.length === 0) return [];
    var seen = [];
    var titles = [];
    symptomIds.forEach(function(id) {
        var articleId = SYMPTOM_ARTICLE_MAP[id];
        if (!articleId || seen.indexOf(articleId) >= 0) return;
        var article = articles.find(function(a) { return a.id === articleId; });
        if (article) {
            seen.push(articleId);
            titles.push(article.title[AppState.language] || article.title['en']);
        }
    });
    return titles;
}

// Called on every chat screen open.  Injects a warm Luna recommendation message
// at most once per symptom-log date so it never repeats for the same save.
function maybeInjectSymptomRecommendation() {
    try {
        var topSymptoms = SymptomLog.getTopSymptoms(3, 2);
        if (!topSymptoms.length) return;
        var log = SymptomLog.getLatest();
        if (!log) return;
        if (Storage.get('lastRecommendationDate') === log.date) return;
        var titles = getLearnRecommendations(topSymptoms);
        if (!titles.length) return;
        var symptomLabels = topSymptoms.map(function(id) {
            var cfg = symptomConfig.find(function(s) { return s.id === id; });
            return cfg ? (cfg.label[AppState.language] || cfg.label['en']) : id;
        });
        var msg;
        if (AppState.language === 'ar') {
            var labelPart = symptomLabels.length > 1
                ? symptomLabels[0] + ' و' + symptomLabels[1]
                : symptomLabels[0];
            msg = 'بناءً على تسجيلك الأخير، لاحظت أن ' + labelPart + ' كانا حاضرَين. ';
            msg += titles.length === 1
                ? 'قد تجدين هذا المقال مفيدًا في قسم التعلم: \u201c' + titles[0] + '\u201d. لا ضغط على الإطلاق — أنا هنا متى كنتِ مستعدة.'
                : 'قد تجدين هذين المقالَين مفيدَين في قسم التعلم: \u201c' + titles[0] + '\u201d و\u201c' + titles[1] + '\u201d. لا ضغط — أنا هنا معك.';
        } else {
            var labelPartEn = symptomLabels.length > 1
                ? symptomLabels[0].toLowerCase() + ' and ' + symptomLabels[1].toLowerCase()
                : symptomLabels[0].toLowerCase();
            msg = 'I noticed from your recent log that ' + labelPartEn + ' has been present. ';
            msg += titles.length === 1
                ? 'There is a helpful article in the Learn section \u2014 \u201c' + titles[0] + '\u201d \u2014 if you would like to explore it. No pressure at all, I am here for whatever you need.'
                : 'You might find these articles in the Learn section helpful: \u201c' + titles[0] + '\u201d and \u201c' + titles[1] + '\u201d. No pressure \u2014 I am right here whenever you are ready.';
        }
        AppState.chatHistory.push({ from: 'luna', text: msg, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) });
        Storage.set('chatHistory', AppState.chatHistory);
        Storage.set('lastRecommendationDate', log.date);
    } catch(e) {}
}

function normaliseSymptomValue(value) {
    if (value === true) return 1;
    if (value === false || value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(5, Math.round(parsed)));
}

function formatSymptomValue(value) {
    return normaliseSymptomValue(value) + '/5';
}

function updateSymptomDisplay(symptomId) {
    if (!AppState.todayLog || !AppState.todayLog.symptoms) return;
    var valEl = document.getElementById('symptom-val-' + symptomId);
    if (valEl) valEl.textContent = formatSymptomValue(AppState.todayLog.symptoms[symptomId]);
}

function persistTodayLog() {
    if (!AppState.todayLog) return;
    let logs = Array.isArray(AppState.logs) ? AppState.logs : [];
    let todayIndex = typeof AppState.todayLogIndex === 'number' ? AppState.todayLogIndex : -1;
    if (todayIndex < 0 || !logs[todayIndex] || logs[todayIndex].date !== AppState.todayLog.date) {
        todayIndex = logs.findIndex(l => l.date === AppState.todayLog.date);
    }
    if (todayIndex >= 0) logs[todayIndex] = AppState.todayLog;
    else {
        logs.push(AppState.todayLog);
        todayIndex = logs.length - 1;
    }
    Storage.set('logs', logs);
    AppState.logs = logs;
    AppState.todayLogIndex = todayIndex;
}

function renderTracker() {
    const logs = Storage.get('logs') || [];
    const today = new Date().toISOString().split('T')[0];
    let todayLogIndex = logs.findIndex(l => l.date === today);
    let todayLog = todayLogIndex >= 0 ? logs[todayLogIndex] : null;
    const isNewTodayLog = !todayLog;
    if (!todayLog) {
        todayLog = { date: today, mood: 3, sleep: 6, stress: 3, water: 5, symptoms: {} };
        symptomConfig.forEach(s => todayLog.symptoms[s.id] = 0);
    }
    // Migrate legacy symptom keys to current IDs
    if (todayLog.symptoms) {
        Object.entries(symptomMigrationMap).forEach(function([oldKey, newKey]) {
            if (todayLog.symptoms[oldKey] !== undefined && todayLog.symptoms[newKey] === undefined) {
                todayLog.symptoms[newKey] = todayLog.symptoms[oldKey];
            }
        });
    } else {
        todayLog.symptoms = {};
    }
    symptomConfig.forEach(function(s) {
        todayLog.symptoms[s.id] = normaliseSymptomValue(todayLog.symptoms[s.id]);
    });
    AppState.todayLog = todayLog;
    AppState.todayLogIndex = todayLogIndex;
    AppState.logs = logs;
    if (isNewTodayLog) persistTodayLog();
    renderWeeklyChart(logs);
    const moodEl = document.getElementById('track-mood');
    const sleepEl = document.getElementById('track-sleep');
    const stressEl = document.getElementById('track-stress');
    const waterEl = document.getElementById('track-water');
    if (moodEl) moodEl.value = todayLog.mood;
    if (sleepEl) sleepEl.value = todayLog.sleep;
    if (stressEl) stressEl.value = todayLog.stress;
    if (waterEl) waterEl.value = todayLog.water;
    updateSliderLabels();
    const symptomList = document.getElementById('symptom-list');
    if (symptomList) {
        symptomList.innerHTML = symptomConfig.map(function(s) {
            var sliderId = 'track-sym-' + s.id;
            var val = normaliseSymptomValue(todayLog.symptoms[s.id]);
            return '<div class="symptom-slider-group">' +
                '<div class="tracker-slider-label">' +
                    '<label for="' + sliderId + '">' + getText(s.label) + '</label>' +
                    '<span id="symptom-val-' + s.id + '">' + formatSymptomValue(val) + '</span>' +
                '</div>' +
                '<input type="range" min="0" max="5" step="1" value="' + val + '" ' +
                    'class="tracker-slider symptom-slider" ' +
                    'id="' + sliderId + '" ' +
                    'data-symptom="' + s.id + '">' +
            '</div>';
        }).join('');
    }
}

function renderWeeklyChart(logs) {
    const chart = document.getElementById('weekly-chart');
    if (!chart) return;
    const days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
    chart.innerHTML = days.map((d, i) => {
        const dateStr = d.toISOString().split('T')[0];
        const log = logs.find(l => l.date === dateStr);
        const height = log ? (log.mood / 5 * 80) + 10 : 10;
        const isToday = i === 6;
        const dayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
        return '<div class="chart-bar-wrapper"><div class="chart-bar ' + (isToday ? 'today' : '') + '" style="height: 80px;"><div class="chart-bar-fill" style="height: ' + height + '%"></div></div><div class="chart-label">' + dayLabel + '</div></div>';
    }).join('');
}

function updateSliderLabels() {
    const moodEl = document.getElementById('val-mood');
    const sleepEl = document.getElementById('val-sleep');
    const stressEl = document.getElementById('val-stress');
    const waterEl = document.getElementById('val-water');
    const trackMood = document.getElementById('track-mood');
    const trackSleep = document.getElementById('track-sleep');
    const trackStress = document.getElementById('track-stress');
    const trackWater = document.getElementById('track-water');
    if (moodEl && trackMood) moodEl.textContent = trackMood.value + '/5';
    if (sleepEl && trackSleep) sleepEl.textContent = trackSleep.value + 'h';
    if (stressEl && trackStress) stressEl.textContent = trackStress.value + '/5';
    if (waterEl && trackWater) waterEl.textContent = trackWater.value + ' glasses';
}

function setSymptom(symptomId, value) {
    if (!AppState.todayLog) return;
    AppState.todayLog.symptoms[symptomId] = normaliseSymptomValue(value);
    persistTodayLog();
    updateSymptomDisplay(symptomId);
}

function saveTracker() {
    if (!AppState.todayLog) return;
    const moodEl = document.getElementById('track-mood');
    const sleepEl = document.getElementById('track-sleep');
    const stressEl = document.getElementById('track-stress');
    const waterEl = document.getElementById('track-water');
    if (moodEl) AppState.todayLog.mood = parseInt(moodEl.value);
    if (sleepEl) AppState.todayLog.sleep = parseFloat(sleepEl.value);
    if (stressEl) AppState.todayLog.stress = parseInt(stressEl.value);
    if (waterEl) AppState.todayLog.water = parseInt(waterEl.value);
    let logs = Storage.get('logs') || [];
    logs = logs.filter(l => l.date !== AppState.todayLog.date);
    logs.push(AppState.todayLog);
    Storage.set('logs', logs); AppState.logs = logs;
    SymptomLog.save(AppState.todayLog);
    if (AppState.userProfile) AppState.userProfile.checkInsCompleted++;
    const btn = document.querySelector('.btn-save');
    if (btn) {
        const original = btn.innerHTML;
        btn.innerHTML = '<span>' + getText({en: 'Saved ✓', ar: 'تم الحفظ ✓'}) + '</span>';
        btn.style.background = 'var(--sage)';
        setTimeout(() => { btn.innerHTML = original; btn.style.background = ''; }, 1500);
    }
    renderHome();
}

document.addEventListener('input', function(e) {
    if (!e.target.classList.contains('tracker-slider')) return;
    if (e.target.classList.contains('symptom-slider')) {
        var symptomId = e.target.dataset.symptom;
        if (symptomId && AppState.todayLog) {
            AppState.todayLog.symptoms[symptomId] = normaliseSymptomValue(e.target.value);
            persistTodayLog();
            updateSymptomDisplay(symptomId);
        }
    } else {
        updateSliderLabels();
    }
});

function renderInsights() {
    const container = document.getElementById('insights-container');
    if (!container) return;
    const logs = Storage.get('logs') || [];
    if (logs.length < 3) {
        container.innerHTML = '<div class="insight-card"><div class="insight-icon" style="background: var(--lavender-light)">&#127807;</div><div class="insight-content"><h4>' + getText({en: 'Keep tracking', ar: 'استمري في التتبع'}) + '</h4><p>' + getText({en: 'Log 3 more days to unlock your insights.', ar: 'سجلي 3 أيام أخرى لفتح رؤاك.'}) + '</p></div></div>';
        return;
    }
    const insights = generateInsights(logs);
    container.innerHTML = insights.map(insight => '<div class="insight-card"><div class="insight-icon" style="background: ' + insight.bg + '">' + insight.icon + '</div><div class="insight-content"><h4>' + insight.title + '</h4><p>' + insight.text + '</p></div></div>').join('');
}

function generateInsights(logs) {
    const recent = logs.slice(-7);
    const avgMood = recent.reduce((a, l) => a + l.mood, 0) / recent.length;
    const avgSleep = recent.reduce((a, l) => a + l.sleep, 0) / recent.length;
    const avgStress = recent.reduce((a, l) => a + l.stress, 0) / recent.length;
    const insights = [];
    if (avgSleep < 5.5) {
        insights.push({ icon: '&#127769;', bg: 'var(--lavender-light)', title: getText({en: 'Sleep pattern detected', ar: 'نمط النوم مكتشف'}), text: getText({ en: "Your sleep has averaged " + avgSleep.toFixed(1) + "h this week. Small changes like a cool, dark room can help restore your rhythm.", ar: "متوسط نومك " + avgSleep.toFixed(1) + "ساعة هذا الأسبوع. تغييرات صغيرة مثل غرفة باردة مظلمة يمكن أن تساعد." }) });
    }
    if (avgStress > 3.5) {
        insights.push({ icon: '&#x1F30A;', bg: 'var(--peach-light)', title: getText({en: 'Stress is running high', ar: 'التوتر مرتفع'}), text: getText({ en: "I have noticed your stress averaging " + avgStress.toFixed(1) + "/5 this week. Gentle movement and hydration are your friends right now.", ar: "لاحظت التوتر يبلغ متوسطه " + avgStress.toFixed(1) + "/5 هذا الأسبوع. الحركة اللطيفة والترطيب صديقاك الآن." }) });
    }
    if (avgMood < 3) {
        insights.push({ icon: '&#9786;', bg: 'var(--rose-light)', title: getText({en: 'Your mood needs nurturing', ar: 'مزاجك يحتاج إلى رعاية'}), text: getText({ en: "Low mood spanning several days often tells us something needs to change — rest, connection, or support. Please consider reaching out.", ar: "المزاج المنخفض الذي يستمر عدة أيام غالبًا يخبرنا أن شيئًا ما يحتاج إلى تغيير. يرجى التفكير في الوصول للدعم." }) });
    }
    insights.push({ icon: '&#128161;', bg: 'var(--sage-light)', title: getText({en: 'Your hydration is helping', ar: 'ترطيبك يساعد'}), text: getText({ en: "Water supports every hormone transition. You are doing the right thing.", ar: "الماء يدعم كل انتقال هرموني. أنت تفعلين الشيء الصحيح." }) });
    return insights;
}

function renderDailyPlan() {
    const container = document.getElementById('daily-plan-container');
    if (!container) return;
    const plan = generateDailyPlan();
    container.innerHTML = plan.sections.map(section => '<div class="plan-section"><div class="plan-section-header"><div class="plan-section-icon" style="background: ' + section.iconBg + '">' + section.icon + '</div><h3>' + section.title + '</h3></div><div class="plan-items">' + section.items.map(item => '<div class="plan-item"><div class="plan-check"></div><div class="plan-item-content"><h4>' + item.name + '</h4><p>' + item.desc + '</p></div></div>').join('') + '</div></div>').join('');
}

function generateDailyPlan() {
    const lang = AppState.language;
    const plans = {
        en: { sections: [
            { icon: '&#9728;', iconBg: 'var(--peach-light)', title: 'Morning', items: [
                { name: 'Gentle wake-up', desc: 'No phone for 10 minutes. Open a window if you can.' },
                { name: 'Warm lemon water', desc: 'Before coffee or tea. Hydration supports hormone transport.' },
                { name: 'Five-minute stretch', desc: 'Neck rolls, shoulder shrugs, gentle spinal twist.' }
            ]},
            { icon: '&#127807;', iconBg: 'var(--sage-light)', title: 'Nutrition', items: [
                { name: 'Protein at every meal', desc: 'Eggs, salmon, lentils, or Greek yoghurt. Supports muscle and mood.' },
                { name: 'Add healthy fats', desc: 'Avocado, olive oil, or a handful of walnuts.' },
                { name: 'Limit caffeine after 2pm', desc: 'Your adrenals will thank you.' }
            ]},
            { icon: '&#9829;', iconBg: 'var(--rose-light)', title: 'Movement', items: [
                { name: '20-minute coastal walk or bush track', desc: 'Gentle cardio without stressing your joints.' },
                { name: 'Pelvic floor exercises', desc: 'Three sets of ten. Protects against leaks as oestrogen drops.' }
            ]},
            { icon: '&#127769;', iconBg: 'var(--lavender-light)', title: 'Evening Wind-Down', items: [
                { name: 'Dim lights at 8pm', desc: 'Signals melatonin production.' },
                { name: 'No screens 30 min before bed', desc: 'Read, stretch, or chat with someone you love.' },
                { name: 'Magnesium spray or bath', desc: 'Eases muscle tension and supports deeper sleep.' }
            ]}
        ]},
        ar: { sections: [
            { icon: '&#9728;', iconBg: 'var(--peach-light)', title: 'الصباح', items: [
                { name: 'استيقاظ لطيف', desc: 'لا هاتف لمدة 10 دقائق. افتحي النافذة إذا أمكن.' },
                { name: 'ماء دافئ بالليمون', desc: 'قبل القهوة أو الشاي. الترطيب يدعم نقل الهرمونات.' },
                { name: 'تمدد لمدة خمس دقائق', desc: 'لف الرقبة، رفع الكتفين، لي العمود الفقري بلطف.' }
            ]},
            { icon: '&#127807;', iconBg: 'var(--sage-light)', title: 'التغذية', items: [
                { name: 'بروتين في كل وجبة', desc: 'بيض، سلمون، عدس، أو زبادي يوناني. يدعم العضلات والمزاج.' },
                { name: 'أضيفي دهون صحية', desc: 'أفوكادو، زيت زيتون، أو حفنة من الجوز.' },
                { name: 'قللي الكافيين بعد الساعة 2', desc: 'غددك الكظرية ستشكرك.' }
            ]},
            { icon: '&#9829;', iconBg: 'var(--rose-light)', title: 'الحركة', items: [
                { name: '20 دقيقة مشي على الساحل أو مسار الغابة', desc: 'cardio لطيف بدون إجهاد مفاصلك.' },
                { name: 'تمارين قاع الحوض', desc: 'ثلاث مجموعات من عشرة. تحمي من التسرب مع انخفاض الإستروجين.' }
            ]},
            { icon: '&#127769;', iconBg: 'var(--lavender-light)', title: 'الاسترخاء المسائي', items: [
                { name: 'خفتي الأضواء الساعة 8 مساءً', desc: 'يشير إلى إنتاج الميلاتونين.' },
                { name: 'لا شاشات قبل النوم بـ 30 دقيقة', desc: 'اقرئي، تمددي، أو تحدثي مع شخص تحبينه.' },
                { name: 'بخاخ أو حمام مغنيسيوم', desc: 'يريح توتر العضلات ويدعم نومًا أعمق.' }
            ]}
        ]}
    };
    return plans[lang];
}

function togglePlanItem(el) { el.parentElement.querySelector('.plan-check').classList.toggle('checked'); }

const communityPosts = {
    stories: [
        { author: 'Sarah, 47', avatar: 'S', time: '2h ago', tag: 'Story', content: { en: "I finally went to my GP yesterday after months of hot flashes and night sweats. I was so nervous, but she listened and we talked about HRT. Feeling hopeful for the first time in ages.", ar: "ذهبت أخيرًا إلى طبيبي أمس بعد أشهر من الهبات الساخنة والتعرق الليلي. كنت عصبية جدًا، لكنها استمعت وتحدثنا عن HRT. أشعر بالأمل لأول مرة منذ وقت طويل." }},
        { author: 'Anonymous', avatar: 'A', time: '5h ago', tag: 'Support', content: { en: "Does anyone else feel like their brain has been replaced with cotton wool? I forgot my own address yesterday. You are not alone.", ar: "هل يشعر أي شخص آخر أن دماغهم تم استبداله بالقطن؟ نسيت عنواني أمس. أنتِ لستِ وحدكِ." }},
        { author: 'Mara, 52', avatar: 'M', time: '1d ago', tag: 'Win', content: { en: "Three weeks of daily coastal walks and my sleep has improved so much. I still wake up once or twice but I feel human again.", ar: "ثلاثة أسابيع من المشي اليومي على الساحل وتحسن نومي كثيرًا. ما زلت أستيقظ مرة أو مرتين لكنني أشعر بأنني بشر مرة أخرى." }},
    ],
    expert: [
        { author: 'Dr. Emma Walsh', avatar: 'E', time: '1d ago', tag: 'Expert', content: { en: "A gentle reminder: brain fog in perimenopause is real and it is biochemical, not personal failure. Your hippocampus is starving for oestrogen. This will pass.", ar: "تذكير لطيف: ضباب الدماغ في فترة ما قبل انقطاع الطمث حقيقي وهو بيوكيميائي، وليس فشلاً شخصيًا. قرنك الآمون يتضور جوعًا من الإستروجين. سيمر هذا." }},
    ],
    support: [
        { author: 'Jen, 44', avatar: 'J', time: '3h ago', tag: 'Support', content: { en: "To whoever needs to hear this today: you are not broken. Your body is transitioning, not failing. The anxiety, the sweats, the brain fog — it is all temporary and it is all treatable.", ar: "لمن يحتاج إلى سماع هذا اليوم: أنتِ لستِ مكسورة. جسدك في انتقال، وليس فشل. القلق، والتعرق، وضباب الدماغ - كل ذلك مؤقت وقابل للعلاج." }},
    ]
};

function renderCommunity(tab) {
    document.querySelectorAll('.comm-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    const feed = document.getElementById('community-feed');
    if (!feed) return;
    const posts = communityPosts[tab] || communityPosts.stories;
    feed.innerHTML = posts.map(post => '<div class="community-post"><div class="post-header"><div class="post-avatar">' + post.avatar + '</div><div class="post-meta"><div class="post-author">' + post.author + '</div><div class="post-time">' + post.time + '</div></div><div class="post-tag">' + post.tag + '</div></div><div class="post-content">' + getText(post.content) + '</div></div>').join('');
}

document.addEventListener('click', (e) => { if (e.target.closest('.comm-tab')) renderCommunity(e.target.closest('.comm-tab').dataset.tab); });

function renderEducation(filter) {
    document.querySelectorAll('.edu-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === filter));
    const feed = document.getElementById('education-feed');
    if (!feed) return;
    const filtered = filter === 'all' ? articles : articles.filter(a => a.filter === filter || a.filter === 'all');
    const featured = filtered.find(a => a.featured);
    const regular = filtered.filter(a => !a.featured);
    let html = '';
    if (featured) {
        html += '<div class="edu-featured" onclick="openArticle(' + featured.id + ')" style="background-image: url(\'' + featured.imageUrl + '\'); background-size: cover; background-position: center;"><span class="edu-featured-badge">' + getText({en: 'Featured', ar: 'مميز'}) + '</span><div class="edu-featured-text"><h3>' + featured.title[AppState.language] + '</h3><div class="edu-card-meta"><span class="edu-reading-time">📖 ' + featured.readTime + '</span><span class="edu-category-badge">' + featured.filter.toUpperCase() + '</span></div></div></div>';
    }
    html += '<div class="edu-grid">' + regular.map(a => '<div class="edu-card" onclick="openArticle(' + a.id + ')"><div class="edu-card-img" style="background-image: url(\'' + a.imageUrl + '\'); background-size: cover; background-position: center;"><div class="edu-card-img-overlay"></div></div><div class="edu-card-body"><h4>' + a.title[AppState.language] + '</h4><div class="edu-card-meta"><span class="edu-reading-time">📖 ' + a.readTime + '</span><span class="edu-category-badge">' + (a.filter === 'all' ? 'wellness' : a.filter).toUpperCase() + '</span></div><p style="margin-top: 8px; font-size: 11px; color: var(--text-muted);">' + (a.author || 'Lunara Team') + '</p></div></div>').join('') + '</div>';
    feed.innerHTML = html;
}

document.addEventListener('click', (e) => { if (e.target.closest('.edu-tab')) renderEducation(e.target.closest('.edu-tab').dataset.filter); });

function openArticle(id) {
    const article = articles.find(a => a.id === id);
    if (!article) return;
    const content = article.content[AppState.language] || article.content['en'];
    const articleHtml = '<div class="article-hero" style="background-image: url(\'' + article.imageUrl + '\'); background-size: cover; background-position: center;"><div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.3));"></div><h1 style="position: relative; z-index: 1; color: white; font-size: 24px; padding: 20px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">' + article.title[AppState.language] + '</h1></div><div class="article-body">' + content + '</div>';
    document.getElementById('article-content').innerHTML = articleHtml;
    if (AppState.userProfile) AppState.userProfile.articlesRead++;
    navigateTo('article');
}

function goBackFromArticle() { navigateTo('education'); }

function renderChat() {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const history = AppState.chatHistory || [];
    container.innerHTML = history.map(msg => '<div class="message message-' + msg.from + '"><div class="message-bubble">' + msg.text + '</div><div class="message-time">' + msg.time + '</div></div>').join('');
    container.scrollTop = container.scrollHeight;
    updateChatLimit();
}

function updateChatLimit() {
    const limitEl = document.getElementById('chat-limit');
    if (!limitEl) return;
    const remaining = AppState.isPremium ? 'Unlimited' : (AppState.messageLimit - AppState.messagesToday) + '/' + AppState.messageLimit;
    limitEl.textContent = getText({ en: remaining + ' messages today', ar: remaining + ' رسائل اليوم' });
    const inputEl = document.getElementById('chat-input');
    if (inputEl) {
        if (!AppState.isPremium && AppState.messagesToday >= AppState.messageLimit) {
            inputEl.disabled = true;
            inputEl.placeholder = getText({ en: 'Upgrade to Premium for unlimited chat', ar: 'ارتقي إلى البريميوم للدردشة غير المحدودة' });
        } else {
            inputEl.disabled = false;
            inputEl.placeholder = getText({ en: 'Ask Luna anything...', ar: 'اسألي لونا أي شيء...' });
        }
    }
}

function sendQuickMessage(btn) { const inputEl = document.getElementById('chat-input'); if (inputEl) { inputEl.value = btn.textContent; sendMessage(); } }

function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input ? input.value.trim() : '';
    if (!text) return;
    if (!AppState.isPremium && AppState.messagesToday >= AppState.messageLimit) { showPremiumModal(); return; }
    const userMsg = { from: 'user', text: text, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) };
    AppState.chatHistory.push(userMsg);
    if (!AppState.isPremium) AppState.messagesToday++;
    Storage.set('chatHistory', AppState.chatHistory); Storage.set('state', AppState);
    if (input) input.value = ''; 
    renderChat(); updateChatLimit();
    setTimeout(() => {
        const response = generateLunaResponse(text);
        AppState.chatHistory.push({ from: 'luna', text: response, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) });
        Storage.set('chatHistory', AppState.chatHistory); renderChat();
    }, 800 + Math.random() * 600);
}

function generateLunaResponse(userText) {
    const lower = userText.toLowerCase();
    const lang = AppState.language;
    const premiumTopics = ['health report', 'detailed analysis', 'full guide', 'weekly report', 'monthly report', 'deep insight', 'personalised plan', 'gp letter', 'hormone test'];
    const wantsPremium = premiumTopics.some(t => lower.includes(t));
    if (wantsPremium && !AppState.isPremium) {
        return getText({ en: "I would love to go deeper on this for you. The full analysis and your personalised health report are waiting inside Premium. In the meantime, I can share that tracking consistency is where the magic happens.", ar: "أحب أن أتعمق في هذا معك. الدليل الكامل وتقريرك الصحي المخصص ينتظرك في البريميوم." });
    }
    if (lower.includes('tired') || lower.includes('exhausted') || lower.includes('fatigue') || lower.includes('energy')) {
        return getText({ en: "I hear you. The exhaustion of perimenopause is different from ordinary tiredness — it is cellular. Your mitochondria, the powerhouses of your cells, are affected by hormonal shifts. Rest is not laziness. It is repair.", ar: "أسمعك. إرهاق فترة ما قبل انقطاع الطمث مختلف عن الإرهاق العادي — إنه على المستوى الخلوي. الراحة ليست كسلاً. إنها إصلاح." });
    }
    if (lower.includes('sleep') || lower.includes('insomnia') || lower.includes('wake') || lower.includes('night')) {
        return getText({ en: "Sleep disruption is one of the cruellest symptoms because everything feels harder without rest. Progesterone, which helps us feel sleepy, is dropping. Cortisol, which should be lowest at night, is often elevated. Try consistency: same bedtime and wake time, even on weekends.", ar: "انقطاع النوم هو أحد أقسى الأعراض لأن كل شيء يبدو أصعب بدون راحة. البروجسترون ينخفض. جرّبي الاتساق: نفس موعد النوم والاستيقاظ." });
    }
    if (lower.includes('anxious') || lower.includes('anxiety') || lower.includes('worry') || lower.includes('panic')) {
        return getText({ en: "Anxiety in perimenopause can feel like it came out of nowhere. One day you were fine, the next your heart is racing over nothing. This is not in your head — it is your neurochemistry. Breathing exercises, movement, and connection help.", ar: "القلق في فترة ما قبل انقطاع الطمث يمكن أن يبدو كأنه جاء من العدم. هذا ليس في رأسك — إنه كيمياء الدماغ." });
    }
    if (lower.includes('hot') || lower.includes('flush') || lower.includes('sweat') || lower.includes('night sweat')) {
        return getText({ en: "Hot flashes happen because your hypothalamus — your internal thermostat — becomes oversensitive. A tiny rise in core temperature triggers a full cooling response. Layers you can remove, cool water nearby, and regular exercise help ease them.", ar: "الهبات الساخنة تحدث لأن الوطاء الخاص بك يصبح حساسًا جدًا. طبقات يمكنك إزالتها والمياه الباردة تساعد." });
    }
    if (lower.includes('brain fog') || lower.includes('forget') || lower.includes('memory') || lower.includes('concentrate') || lower.includes('focus')) {
        return getText({ en: "Brain fog is real, and it is not a sign you are losing your mind. Oestrogen supports acetylcholine, a neurotransmitter crucial for memory and learning. When levels fall, so does focus. Sleep, protein, hydration, and movement all help rebuild it.", ar: "ضباب الدماغ حقيقي، وليس علامة على فقدانك عقلك. النوم والبروتين والترطيب والحركة كلها تساعد." });
    }
    if (lower.includes('gp') || lower.includes('doctor') || lower.includes('hrt') || lower.includes('hormone replacement')) {
        return getText({ en: "Speaking with your GP is a brave and important step. Many GPs are well-trained in menopause care. You can ask for a longer appointment and bring notes on your symptoms. You deserve to be heard.", ar: "التحدث مع طبيبك خطوة شجاعة. استحقي أن تُسمعي صوتك." });
    }
    if (lower.includes('food') || lower.includes('eat') || lower.includes('diet') || lower.includes('nutrition') || lower.includes('weight')) {
        return getText({ en: "Nutrition in perimenopause is about nourishment, not restriction. Your body needs more protein than before — aim for 25–30g per meal. Healthy fats are your friend. Avoid skipping meals, which can spike cortisol.", ar: "التغذية في فترة ما قبل انقطاع الطمث هي عن التغذية، وليس التقييد. جسدك يحتاج إلى بروتين أكثر." });
    }
    if (lower.includes('exercise') || lower.includes('workout') || lower.includes('walk') || lower.includes('movement') || lower.includes('yoga')) {
        return getText({ en: "Movement is medicine, but gentle is the keyword now. High-intensity workouts can spike cortisol when your system is already stressed. Instead, try a coastal walk, tai chi, or restorative yoga. Your nervous system will thank you.", ar: "الحركة هي الدواء، لكن لطيفة هي الكلمة الأساسية الآن. المشي الساحلي أو تاي تشي أو اليوغا الترميمية." });
    }
    if (lower.includes('mood') || lower.includes('sad') || lower.includes('depress') || lower.includes('cry') || lower.includes('tear')) {
        return getText({ en: "The mood swings of perimenopause can feel like PMS multiplied by ten. One moment you are fine, the next you are sobbing. This is not weakness. Your brain chemistry is recalibrating. Connection, movement, and rest help.", ar: "تقلبات المزاج في فترة ما قبل انقطاع الطمث يمكن أن تشعر مثل الدورة مضروبة في عشرة. هذا ليس ضعفًا." });
    }
    if (lower.includes('alone') || lower.includes('lonely') || lower.includes('support') || lower.includes('friend') || lower.includes('partner') || lower.includes('husband')) {
        return getText({ en: "Feeling alone in this is one of the hardest parts. So many women suffer in silence because menopause is still treated like a taboo. But you are not alone. Thousands are here with you, in this together. Reach out.", ar: "الشعور بالوحدة هو أحد أصعب الأجزاء. لكنك لستِ وحدك. آلاف النساء هنا معك." });
    }
    if (lower.includes('perimenopause') || lower.includes('what is') || lower.includes('explain')) {
        return getText({ en: "Perimenopause is the transition phase before menopause. It usually starts in your 40s, sometimes earlier. Your ovaries gradually slow down oestrogen production, and hormone levels become unpredictable. This can last 4–10 years. You are not going mad — your body is simply transitioning.", ar: "فترة ما قبل انقطاع الطمث هي مرحلة الانتقال قبل انقطاع الطمث. عادة ما يبدأ في الأربعينات. أنتِ لستِ مجنونة — جسدك في انتقال." });
    }
    return getText({
        en: "Thank you for sharing that with me. I want you to know that whatever you are feeling right now is valid. Your body is going through one of the biggest hormonal shifts of your life, and I am here to walk beside you through it. You are not alone, and you are not broken.",
        ar: "شكرًا لمشاركتي ذلك. أريدك أن تعرفي أن كل ما تشعرين به الآن صحيح. أنا هنا معك. أنتِ لستِ وحدك."
    });
}

function showPremiumModal() {
    const modal = document.getElementById('premium-modal');
    if (modal) modal.classList.remove('hidden');
}
function closePremiumModal() {
    const modal = document.getElementById('premium-modal');
    if (modal) modal.classList.add('hidden');
}

function renderProfile() {
    const profileContainer = document.getElementById('profile-content');
    if (!profileContainer) return;
    
    const profile = AppState.userProfile || AppState.user || {};
    const stats = [
        { label: getText({en: 'Articles Read', ar: 'مقالات مقروءة'}), value: profile.articlesRead || 0 },
        { label: getText({en: 'Check-ins', ar: 'التسجيلات'}), value: profile.checkInsCompleted || 0 },
        { label: getText({en: 'Saved Articles', ar: 'مقالات محفوظة'}), value: profile.savedArticles || 0 },
        { label: getText({en: 'Streak', ar: 'سلسلة'}), value: profile.streak || 1 }
    ];
    
    profileContainer.innerHTML = `
        <div class="profile-header">
            <div class="profile-avatar-large">
                <div class="profile-initial">${(profile.name || 'U')[0].toUpperCase()}</div>
            </div>
            <h2 class="profile-name">${profile.name || 'User'}</h2>
            <p class="profile-email">${profile.email || 'user@lunara.app'}</p>
            <p class="profile-membership">${AppState.isPremium ? getText({en: 'Premium Member', ar: 'عضو بريميوم'}) : getText({en: 'Free Member', ar: 'عضو مجاني'})}</p>
        </div>
        
        <div class="profile-stats-grid">
            ${stats.map(stat => '<div class="profile-stat"><div class="stat-num">' + stat.value + '</div><div class="stat-text">' + stat.label + '</div></div>').join('')}
        </div>
        
        <button class="btn-primary" style="margin: 24px 0 12px;" onclick="navigateTo('settings')">
            <span>${getText({en: 'Account Settings', ar: 'إعدادات الحساب'})}</span>
        </button>
    `;
}

function renderSettings() {
    document.getElementById('theme-toggle').checked = AppState.theme === 'dark';
    document.getElementById('current-lang').textContent = AppState.language === 'en' ? 'English' : 'العربية';
    const premiumStatus = document.getElementById('premium-status');
    if (premiumStatus) premiumStatus.textContent = AppState.isPremium ? (AppState.language === 'en' ? 'Active' : 'نشط') : getText({en: 'Free', ar: 'مجاني'});
}

function selectPlan(el, plan) {
    document.querySelectorAll('.pricing-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
}

function subscribe() {
    AppState.isPremium = true;
    Storage.set('state', AppState);
    alert(getText({en: 'Welcome to Lunara Premium! This is a demo — no real payment was processed.', ar: 'مرحبًا بك في لونارا بريميوم! هذا عرض تجريبي - لم يتم معالجة أي دفع حقيقي.'}));
    navigateTo('home');
}

function toggleTheme() {
    AppState.theme = AppState.theme === 'light' ? 'dark' : 'light';
    applyTheme();
    Storage.set('state', AppState);
}

function applyTheme() {
    document.body.classList.toggle('dark-mode', AppState.theme === 'dark');
    document.body.classList.toggle('light-mode', AppState.theme !== 'dark');
}

function toggleLanguage() {
    AppState.language = AppState.language === 'en' ? 'ar' : 'en';
    applyLanguage();
    Storage.set('state', AppState);
    renderSettings();
    if (AppState.currentScreen === 'home') renderHome();
    if (AppState.currentScreen === 'tracker') renderTracker();
    if (AppState.currentScreen === 'community') renderCommunity('stories');
    if (AppState.currentScreen === 'education') renderEducation('all');
    if (AppState.currentScreen === 'chat') renderChat();
    if (AppState.currentScreen === 'daily-plan') renderDailyPlan();
    if (AppState.currentScreen === 'profile') renderProfile();
}

function applyLanguage() {
    document.documentElement.lang = AppState.language;
    document.body.dir = AppState.language === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-en]').forEach(el => {
        if (AppState.language === 'ar' && el.dataset.ar) {
            if (el.tagName === 'INPUT') el.placeholder = el.dataset.ar;
            else el.textContent = el.dataset.ar;
        } else {
            if (el.tagName === 'INPUT') el.placeholder = el.dataset.en;
            else el.textContent = el.dataset.en;
        }
    });
}

function getText(obj) {
    return obj[AppState.language] || obj['en'];
}

function resetApp() {
    if (confirm(getText({en: 'This will erase all your data. Are you sure?', ar: 'سيؤدي هذا إلى مسح جميع بياناتك. هل أنت متأكدة؟'}))) {
        Storage.clear();
        location.reload();
    }
}

function setupEventListeners() {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
}

document.addEventListener('DOMContentLoaded', init);
