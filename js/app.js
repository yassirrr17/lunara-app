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
const LATEST_SYMPTOM_LOG_KEY = 'latestSymptomLog';

// Ensures stored values are plain JSON-like objects only.
function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

// Creates a full symptom snapshot using all configured symptom keys.
function buildSymptomSnapshot(symptoms) {
    const snapshot = {};
    symptomConfig.forEach(function(s) {
        snapshot[s.id] = normaliseSymptomValue(symptoms && symptoms[s.id]);
    });
    return snapshot;
}

function isValidSymptomLog(value) {
    return isPlainObject(value)
        && typeof value.date === 'string'
        && typeof value.timestamp === 'number'
        && isPlainObject(value.symptoms);
}

const SymptomLog = {
    save(log) {
        try {
            if (!log || typeof log.date !== 'string') return;
            const snapshot = {
                date: log.date,
                timestamp: Date.now(),
                symptoms: buildSymptomSnapshot(log.symptoms)
            };
            Storage.set(LATEST_SYMPTOM_LOG_KEY, snapshot);
        } catch(e) {}
    },
    getLatest() {
        try {
            const data = Storage.get(LATEST_SYMPTOM_LOG_KEY);
            if (!isValidSymptomLog(data)) return null;
            return {
                date: data.date,
                timestamp: data.timestamp,
                symptoms: buildSymptomSnapshot(data.symptoms)
            };
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
      content: { en: '<div class="article-body"><p>Menopause is not a single event. It is a natural biological transition that unfolds across years, and understanding its three distinct phases can help you feel more informed, more prepared, and less alone on the journey. In New Zealand and Australia, most women reach menopause around the age of 51, though it can occur anywhere from the mid-40s to the late 50s.</p><h3>Perimenopause — The Transition Begins</h3><p>Perimenopause is the transitional phase that leads up to your final menstrual period. It typically begins in the mid-to-late 40s, though some women notice hormonal changes in their late 30s. This phase can last anywhere from two to ten years.</p><p>During perimenopause, your ovaries gradually produce less oestrogen and progesterone, but hormone levels fluctuate unpredictably rather than declining in a smooth, steady curve. This unpredictability is part of what makes perimenopause so challenging to navigate.</p><p>Common signs include irregular or heavier periods, hot flushes, night sweats, disturbed sleep, mood changes, brain fog, and shifts in libido. According to the Australasian Menopause Society, recognising perimenopause early gives women the best opportunity to access information and make informed decisions about their health and wellbeing.</p><p>If you are experiencing these changes, speaking with your GP is the right first step. In some cases, a blood test measuring FSH (follicle-stimulating hormone) levels can help clarify what is happening, though results during perimenopause can be variable. Health Navigator NZ provides detailed, NZ-specific guidance at <em>healthnavigator.org.nz</em>.</p><h3>Menopause — The Milestone</h3><p>Menopause is defined as the point at which you have gone 12 consecutive months without a menstrual period. It is technically a single moment in time — the 12-month anniversary of your last period — rather than a prolonged state.</p><p>The average age at menopause in New Zealand and Australia is 51 years. Premature menopause (before age 40) affects approximately one in 100 women, and early menopause (before age 45) also occurs. Both carry additional health considerations, particularly around bone density and cardiovascular health, and specialist support is especially important in these situations.</p><p>Hot flushes and sleep disruption often peak around the time of the final period before gradually settling. Menopausal hormone therapy (MHT) is one option many women consider for managing symptoms; your GP can discuss whether it may be appropriate for your individual circumstances.</p><h3>Postmenopause — Life After the Milestone</h3><p>Postmenopause begins the day after your 12-month anniversary without a period and continues for the rest of your life. Many women find that the more disruptive symptoms — hot flushes, mood instability, and irregular bleeding — ease considerably once postmenopause is reached.</p><p>Bone health becomes a key priority in postmenopause. Osteoporosis affects approximately one in three women in Australia over the age of 60, with comparable rates in New Zealand. Weight-bearing exercise, adequate calcium and vitamin D intake, and regular GP check-ups are all important parts of maintaining long-term wellbeing.</p><h3>Every Woman Is Different</h3><p>Each woman experiences this transition in her own way. Some navigate it with minimal disruption; others find it significantly challenging. Both are entirely valid experiences. What matters is having access to accurate information, a supportive GP, and the understanding that this is a normal part of life.</p><p>For further information, visit Health Navigator NZ (<em>healthnavigator.org.nz</em>), Jean Hailes for Women&#39;s Health (<em>jeanhailes.org.au</em>), and the Australasian Menopause Society (<em>menopause.org.au</em>) for evidence-based NZ and Australian guidance.</p><p class="article-source"><em>Sources: Health Navigator NZ, Australasian Menopause Society, Jean Hailes for Women&#39;s Health, Ministry of Health NZ</em></p></div>', ar: '<div class="article-body"><p>انقطاع الطمث ليس حدثًا واحدًا. إنها رحلة بثلاث مراحل.</p></div>' }},
    { id: 2, filter: 'peri', title: { en: 'Why Brain Fog Is Real & What Helps', ar: 'لماذا ضباب الدماغ حقيقي (وما يساعد)' }, readTime: '5 min', imageUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&h=450&fit=crop', author: 'Dr. Sarah Chen', publishDate: '2024-03-10',
      content: { en: '<div class="article-body"><p>Brain fog is one of the most disorienting symptoms of perimenopause and menopause — and one of the least talked about. You might find yourself mid-sentence having completely lost your train of thought, forget a familiar word, miss an appointment, or simply feel as though your thinking has slowed. This experience is real, it is recognised, and it is not a sign that something is permanently wrong.</p><h3>The Science Behind It</h3><p>Oestrogen plays a significant role in brain function. It supports the production of acetylcholine, a neurotransmitter critical for memory, concentration, and learning. It also influences dopamine and serotonin pathways and promotes blood flow to the brain. When oestrogen levels drop and fluctuate during perimenopause, these processes are directly disrupted.</p><p>Research supported by Jean Hailes for Women&#39;s Health confirms that cognitive symptoms — including forgetfulness, difficulty concentrating, and mental fatigue — are genuinely experienced by a large proportion of women during the menopausal transition. These symptoms tend to peak during perimenopause and often improve once hormone levels stabilise after menopause.</p><p>Your brain is not broken. It is adapting to a significant hormonal shift, and for most women, cognitive clarity does return.</p><h3>What Can Help</h3><p><strong>Sleep is foundational.</strong> Your brain consolidates memories and clears metabolic waste during sleep. When sleep is disrupted — as it often is during perimenopause — cognitive function is among the first things to suffer. Prioritising sleep, even imperfectly, matters.</p><p><strong>Regular physical activity</strong> has a well-established benefit for brain health. Even a 30-minute walk several times a week has been shown to improve memory, concentration, and mental clarity. Exercise increases blood flow to the brain and supports the growth of new neural connections. In the summer months across New Zealand and Australia (December through February), early morning walks before the heat builds are especially effective.</p><p><strong>Staying well hydrated</strong> is simple but often overlooked. Even mild dehydration significantly worsens cognitive symptoms. Aim for at least six to eight glasses of water daily. Alcohol, even in moderate amounts, can worsen brain fog and is worth reducing.</p><p><strong>Protein at every meal</strong> provides the amino acids your brain needs for neurotransmitter production. Good options include eggs, legumes, fish, dairy, lean meat, and tofu.</p><p><strong>Managing stress</strong> matters too. Cortisol, the stress hormone, interferes with memory and concentration. Mindfulness, breathing practices, and time outdoors all help regulate the nervous system.</p><h3>When to See Your GP</h3><p>If brain fog is severe, has come on suddenly, or is accompanied by other neurological symptoms, speak with your GP to rule out other causes. Thyroid function, iron levels, and vitamin B12 deficiency can all cause cognitive symptoms and are easily checked with a blood test.</p><p>Menopausal hormone therapy (MHT) is worth discussing with your GP if brain fog is significantly affecting your daily life. For some women, MHT helps restore oestrogen to a level that supports clearer thinking, particularly when started during perimenopause or early menopause.</p><p>Health Navigator NZ (<em>healthnavigator.org.nz</em>) and Jean Hailes for Women&#39;s Health (<em>jeanhailes.org.au</em>) both offer helpful, NZ and Australian-specific resources on cognitive changes during menopause. The fact that you notice and worry about brain fog is itself a sign that your brain is working well — this phase passes for most women.</p><p class="article-source"><em>Sources: Jean Hailes for Women&#39;s Health, Health Navigator NZ, Australasian Menopause Society</em></p></div>', ar: '' }},
    { id: 3, filter: 'menopause', title: { en: 'Hot Flushes: The Science of Sudden Heat', ar: 'الهبات الساخنة: علم الحرارة المفاجئة' }, readTime: '3 min', imageUrl: 'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&h=450&fit=crop', author: 'Dr. James Miller', publishDate: '2024-03-05',
      content: { en: '<div class="article-body"><p>Hot flushes are one of the most widely recognised symptoms of menopause — and one of the most misunderstood. They are not random, and they are not imagined. They are a predictable physiological response to falling oestrogen levels, and understanding the science behind them can make the experience a little less frightening.</p><h3>What Is Happening in Your Body</h3><p>Your hypothalamus is the region of the brain that acts as your internal thermostat. In a body with stable oestrogen levels, the hypothalamus maintains a comfortable temperature range — a narrow thermoneutral zone — and keeps your body temperature regulated.</p><p>When oestrogen levels decline and fluctuate, the hypothalamus becomes oversensitive. The thermoneutral zone narrows dramatically. A tiny change in core body temperature — sometimes as small as 0.5°C — is enough to trigger a full-body cooling response: blood vessels near the skin dilate, you flush red, your heart rate increases, and sweating begins. The result is the intense wave of heat, often followed by a chill, that characterises a hot flush.</p><p>Hot flushes typically last between two and four minutes, though they can sometimes extend longer. According to the Australasian Menopause Society, up to 80 per cent of women experience hot flushes during the menopausal transition, making them by far the most common symptom. For many women they continue for several years after menopause.</p><h3>Night Sweats and Sleep Disruption</h3><p>When hot flushes occur during sleep they are called night sweats. Core body temperature rises naturally in the evening as part of the sleep cycle, which is why many women find that flushes are worse at night. Night sweats often cause waking several times, significantly disrupting sleep quality and creating flow-on effects for mood, energy, and cognitive function.</p><h3>Common Triggers in NZ and AU</h3><p>Certain factors are known to make hot flushes more intense or more frequent. In the New Zealand and Australian summer — running from December through February — heat and humidity can make symptoms notably worse. Common individual triggers include:</p><ul><li>Hot drinks, alcohol, and spicy food</li><li>Warm environments and synthetic clothing</li><li>Stress and anxiety</li><li>Smoking</li><li>Caffeine</li></ul><p>Keeping a brief symptom diary can help you identify your personal triggers and plan around them.</p><h3>Practical Strategies That Help</h3><p>Layering light, breathable clothing — linen, cotton, or bamboo — allows you to remove layers quickly during a flush. Keeping a cool glass of water nearby and a small fan at your desk or bedside helps. Cooling the wrists or back of the neck with cool water during a flush can provide immediate relief.</p><p>Regular aerobic exercise has been shown in clinical studies to reduce the frequency and severity of hot flushes over time. Even regular walks during the cooler parts of the day — early morning or evening — are beneficial.</p><p>Cognitive behavioural therapy (CBT) tailored for menopause symptoms has a strong evidence base and is available through some GPs, psychologists, and health services across New Zealand and Australia.</p><h3>Medical Options</h3><p>Menopausal hormone therapy (MHT) remains the most effective medical treatment for hot flushes and night sweats. If hot flushes are significantly affecting your quality of life, speaking with your GP about whether MHT or another approach is suitable for you is worthwhile. Non-hormonal prescription options also exist for women who cannot or prefer not to use MHT.</p><p>The Australasian Menopause Society (<em>menopause.org.au</em>) and Healthdirect Australia (<em>healthdirect.gov.au</em>) both provide clear, evidence-based guidance on treatment options. Health Navigator NZ (<em>healthnavigator.org.nz</em>) offers NZ-specific information including GP referral pathways.</p><p class="article-source"><em>Sources: Australasian Menopause Society, Healthdirect Australia, Health Navigator NZ</em></p></div>', ar: '' }},
    { id: 4, filter: 'peri', title: { en: 'Rebuilding Sleep When Hormones Shift', ar: 'إعادة بناء النوم عندما تتغير الهرمونات' }, readTime: '4 min', imageUrl: 'https://images.unsplash.com/photo-1531512073830-ba890ca4eba2?w=800&h=450&fit=crop', author: 'Dr. Lisa Wong', publishDate: '2024-02-28',
      content: { en: '<div class="article-body"><p>Sleep disruption is one of the most common and most exhausting symptoms of the menopausal transition. In New Zealand and Australia, surveys consistently show that difficulty sleeping is among the top concerns women report during perimenopause and menopause. When sleep deteriorates, everything else becomes harder — mood, concentration, physical health, and emotional resilience are all affected.</p><h3>Why Hormones Disrupt Sleep</h3><p>Several interconnected hormonal changes contribute to sleep difficulties during this stage of life.</p><p><strong>Progesterone</strong>, which has mild sedative properties, declines during perimenopause. Lower progesterone means losing one of the natural mechanisms that helped you fall and stay asleep.</p><p><strong>Oestrogen</strong> plays a role in regulating sleep architecture — the cycling between light and deep sleep stages. As oestrogen levels drop and fluctuate, sleep becomes lighter and more fragmented. Oestrogen also influences the regulation of core body temperature, which is closely tied to sleep quality.</p><p><strong>Hot flushes and night sweats</strong> directly interrupt sleep. Many women wake repeatedly as the body heats and cools, making it difficult to achieve restorative sleep. The effect compounds over time.</p><p><strong>Cortisol</strong>, the stress hormone, which should naturally be at its lowest point during the night, is often elevated in women going through the menopausal transition. This can make it difficult to fall asleep and to return to sleep after waking.</p><h3>Building Better Sleep</h3><p>The good news is that sleep quality can be genuinely improved with a combination of behavioural strategies, environment changes, and where appropriate, medical support.</p><p><strong>Consistency is the foundation.</strong> Going to bed and waking at the same times each day — including weekends — helps anchor your body clock. Even after a poor night, getting up at your regular time maintains the sleep pressure that makes it easier to fall asleep the following night.</p><p><strong>Your sleep environment matters.</strong> Aim for a cool, dark, and quiet room. The optimal sleep temperature is generally between 16°C and 19°C. In the New Zealand and Australian summer months (December through February), managing bedroom temperature becomes especially important — a fan, light cotton bedding, and ventilating the room during the cooler parts of the night can all make a significant difference.</p><p><strong>Reducing evening light exposure</strong> helps your brain produce melatonin. Dimming lights and reducing screen use in the hour or two before bed supports your natural sleep signals.</p><p><strong>Limiting alcohol</strong> is important, even though alcohol may initially feel sedating. It significantly reduces sleep quality during the second half of the night and worsens night sweats.</p><p><strong>Magnesium glycinate</strong>, taken in the evening, is something many women find helpful for relaxing the nervous system and supporting sleep. Speak with your GP or pharmacist before adding supplements.</p><h3>Managing the Underlying Causes</h3><p>Managing hot flushes — through cooling strategies, clothing choices, and if appropriate, menopausal hormone therapy (MHT) — will also improve sleep. For women whose sleep disruption is primarily driven by hot flushes and night sweats, MHT can be highly effective. Speak with your GP about whether this approach may be suitable for you.</p><p>Cognitive behavioural therapy for insomnia (CBT-I) has a strong evidence base and is considered a first-line treatment for chronic sleep difficulties. It is available through some GPs and psychologists in New Zealand and Australia.</p><p>If sleep difficulties are severe or have persisted for more than a few months, speak with your GP. Health Navigator NZ (<em>healthnavigator.org.nz</em>) and Jean Hailes for Women&#39;s Health (<em>jeanhailes.org.au</em>) offer practical, evidence-based guidance on sleep during menopause.</p><p class="article-source"><em>Sources: Health Navigator NZ, Jean Hailes for Women&#39;s Health, Australasian Menopause Society</em></p></div>', ar: '' }},
    { id: 5, filter: 'post', title: { en: 'Nutrition After 40: The Quiet Upgrade', ar: 'التغذية بعد 40: الترقية الهادئة' }, readTime: '4 min', imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=450&fit=crop', author: 'Dr. Amanda Roberts', publishDate: '2024-02-20',
      content: { en: '<div class="article-body"><p>The nutritional needs of women change significantly from their 40s onward, and the menopausal transition accelerates some of those changes. Relatively straightforward adjustments to how and what you eat can have a meaningful impact on how you feel — your energy, your mood, your bone health, and your long-term wellbeing.</p><h3>Why Nutritional Needs Change</h3><p>As oestrogen declines during perimenopause and menopause, several important biological shifts occur. Bone density decreases, increasing the risk of osteoporosis. Muscle mass tends to decline more rapidly — a process called sarcopenia. Cardiovascular risk factors shift. Metabolism changes and blood sugar regulation can become less efficient.</p><p>These changes are not inevitable, but they are real — and nutrition is one of the most powerful tools available to support your health through this transition.</p><h3>Protein: More Important Than Ever</h3><p>Adequate protein intake is one of the single most important dietary priorities after 40. Protein supports muscle mass, stabilises blood sugar, and provides the amino acids needed for neurotransmitter production — which affects mood and cognitive function.</p><p>Australian and New Zealand dietary guidance suggests that women over 50 benefit from slightly higher protein intake than younger adults. Aim for a source of protein at every meal. Good options include eggs, legumes and lentils, fish, chicken, dairy products such as yoghurt and cheese, tofu, and nuts. A handful of mixed nuts as a snack is a simple and effective daily habit.</p><h3>Calcium and Bone Health</h3><p>After menopause, oestrogen no longer provides the same protective effect on bone density. The recommended calcium intake for women over 50 in New Zealand and Australia is 1,300 mg per day. Dairy foods are among the most concentrated sources, but non-dairy sources include fortified plant milks, canned fish with bones (such as salmon and sardines), firm tofu, and leafy greens such as kale, bok choy, and silverbeet.</p><p>Vitamin D is equally important for calcium absorption. Women in New Zealand and southern Australia, particularly during the winter months (June through August), may not produce enough vitamin D through sun exposure alone. A blood test to check vitamin D levels is a straightforward step, and supplementation is often recommended by GPs in this situation.</p><h3>Iron, B Vitamins, and Gut Health</h3><p>Women who have experienced heavy periods during perimenopause may develop iron deficiency. Once periods cease, iron requirements decrease, but it is worth having your levels checked. B vitamins — particularly B12 and folate — support energy production and neurological health. Plant-based diets may be lower in B12, and supplementation may be appropriate; speak with your GP.</p><p>A diet rich in fibre supports gut health, which is increasingly understood to influence mood, immunity, and overall wellbeing. Legumes, whole grains, and a wide variety of vegetables all contribute.</p><h3>Eating Well with Local Foods</h3><p>The abundance of fresh produce available across New Zealand and Australia is a genuine advantage. Some particularly beneficial foods for this stage of life include:</p><ul><li><strong>Kumara (sweet potato):</strong> rich in fibre, potassium, and antioxidants — excellent roasted, in soups, or as a warming winter side dish</li><li><strong>Leafy greens:</strong> spinach, silverbeet, and kale are nutrient-dense and widely available year-round</li><li><strong>Oily fish:</strong> salmon, sardines, and mackerel provide omega-3 fatty acids supporting brain and cardiovascular health</li><li><strong>Legumes:</strong> chickpeas, lentils, and cannellini beans are affordable, high in fibre and protein, and support gut health</li><li><strong>Kiwifruit:</strong> an outstanding source of vitamin C and antioxidants, widely available across New Zealand and Australia</li></ul><h3>Hydration and Alcohol</h3><p>Staying well hydrated supports energy, skin health, digestion, and cognitive function. Aim for at least six to eight glasses of water daily, and more during the hot New Zealand and Australian summer months. Alcohol is worth reducing — it disrupts sleep, worsens hot flushes, and provides little nutritional benefit.</p><p>A consultation with your GP or a registered dietitian can help you develop a nutrition plan tailored to your individual health needs. Jean Hailes for Women&#39;s Health (<em>jeanhailes.org.au</em>) and Healthdirect Australia (<em>healthdirect.gov.au</em>) also have excellent nutrition resources for women in midlife.</p><p class="article-source"><em>Sources: Jean Hailes for Women&#39;s Health, Healthdirect Australia, Ministry of Health NZ, Australasian Menopause Society</em></p></div>', ar: '' }},
    { id: 6, filter: 'all', title: { en: 'Hormone Changes & Emotional Wellbeing', ar: 'تغييرات الهرمونات والرفاهية العاطفية' }, readTime: '5 min', imageUrl: 'https://images.unsplash.com/photo-1477332552946-cfb384aeaf1c?w=800&h=450&fit=crop', author: 'Dr. Rachel Green', publishDate: '2024-02-15',
      content: { en: '<div class="article-body"><p>The emotional changes that accompany perimenopause and menopause are not imagined, not exaggerated, and not a sign of weakness. They are real, they are common, and they are firmly grounded in the biochemistry of hormonal change. Understanding why these shifts happen is an important first step — and knowing where to find support matters too.</p><h3>The Biochemical Connection</h3><p>Oestrogen plays a significant role in regulating the brain chemicals that influence mood. It supports the production of serotonin — often called the feel-good neurotransmitter — as well as dopamine, noradrenaline, and beta-endorphins. When oestrogen levels fluctuate unpredictably during perimenopause and then decline after menopause, the systems that regulate mood and emotional resilience are directly affected.</p><p>This is why increased anxiety, low mood, tearfulness, irritability, and a reduced tolerance for stress are so common during the menopausal transition. These symptoms are not personality flaws or signs of mental illness — they are physiological responses to hormonal change.</p><p>According to Jean Hailes for Women&#39;s Health, women are at a higher risk of experiencing depression and anxiety during perimenopause than at other life stages. This is particularly true for women who have a previous history of depression, premenstrual mood symptoms, or significant life stressors occurring at the same time.</p><h3>What You Might Experience</h3><p>Emotional symptoms of perimenopause and menopause can include:</p><ul><li>Increased anxiety or feelings of panic</li><li>Low mood or sadness that comes in waves</li><li>Irritability and reduced patience</li><li>Emotional reactivity or tearfulness that feels out of proportion</li><li>A general sense of losing yourself</li><li>Reduced motivation or enjoyment in things you normally love</li></ul><p>Many women describe feeling relief simply from learning that what they are going through has a name and a cause. These experiences are widely shared.</p><h3>Looking After Your Emotional Health</h3><p>Speaking with your GP is the most important first step. Your GP can assess whether symptoms reflect hormonal changes, depression, anxiety, or a combination, and can discuss the full range of options — including menopausal hormone therapy (MHT), which can significantly improve mood symptoms in some women, as well as psychological support and, where appropriate, medication.</p><p>Regular movement has a powerful effect on mood. Exercise stimulates the release of endorphins and supports serotonin production. Even regular outdoor walks — in the fresh air and natural light that New Zealand and Australia have in abundance — can make a noticeable difference.</p><p>Social connection matters enormously. Isolation tends to intensify emotional symptoms. Maintaining regular contact with friends, family, or a peer support group — even when energy is low — supports emotional resilience.</p><p>Mindfulness, breathing practices, and adequate sleep all support the nervous system and can reduce the intensity of anxiety and mood symptoms over time.</p><h3>Getting Support in New Zealand and Australia</h3><p>If you are struggling with your emotional wellbeing, you do not have to manage it alone.</p><p>In <strong>New Zealand</strong>, you can call or text <strong>1737</strong> at any time of the day or night to speak with a trained counsellor — it is free, available 24 hours, and completely confidential. The Mental Health Foundation of New Zealand (<em>mentalhealth.org.nz</em>) also offers resources and pathways to support.</p><p>In <strong>Australia</strong>, <strong>Lifeline</strong> is available 24 hours on <strong>13 11 14</strong>. Beyond Blue (<em>beyondblue.org.au</em>) offers online resources, self-help tools, and pathways to professional support.</p><p>For menopause-specific emotional support and information, Jean Hailes for Women&#39;s Health (<em>jeanhailes.org.au</em>), Health Navigator NZ (<em>healthnavigator.org.nz</em>), and the Australasian Menopause Society (<em>menopause.org.au</em>) are all excellent, evidence-based resources. You deserve support — asking for help is a sign of self-awareness and self-care, not weakness.</p><p class="article-source"><em>Sources: Jean Hailes for Women&#39;s Health, Health Navigator NZ, Australasian Menopause Society, Mental Health Foundation NZ, Beyond Blue</em></p></div>', ar: '' }},
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
// Primary strategy: discover matching articles from existing Learn metadata.
// Fallback strategy: map symptom IDs to article IDs if metadata matching fails.
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

const SYMPTOM_ARTICLE_HINTS = {
    'hot-flashes-night-sweats': ['hot flash', 'hot flush', 'night sweat', 'sudden heat'],
    'sleep-problems': ['sleep', 'insomnia', 'night', 'rest'],
    'brain-fog-memory': ['brain fog', 'memory', 'focus', 'concentrat'],
    'mood-changes-irritability': ['mood', 'emotional', 'irritab', 'wellbeing'],
    'anxiety': ['anxiety', 'emotional', 'wellbeing', 'mood'],
    'fatigue-exhaustion': ['nutrition', 'energy', 'fatigue', 'protein'],
    'joint-muscle-aches': ['strength', 'muscle', 'joint', 'training'],
    'headaches': ['hormone', 'stage', 'menopause'],
    'weight-gain': ['nutrition', 'weight', 'metabolism', 'protein'],
    'vaginal-dryness': ['postmenopause', 'menopause', 'stages']
};

// Uses Learn metadata text at runtime so recommendations follow current article copy.
function getArticleText(article) {
    if (!article) return '';
    const title = article.title || {};
    const content = article.content || {};
    return ((title.en || '') + ' ' + (content.en || '')).toLowerCase();
}

let articleTextIndexCache = null;

function getArticleTextIndex() {
    if (!articleTextIndexCache) {
        // Article metadata is static for this runtime, so a lazy cache is sufficient.
        // If articles are changed dynamically, reset `articleTextIndexCache` to rebuild it.
        articleTextIndexCache = articles.map(function(article) {
            return { article: article, text: getArticleText(article) };
        });
    }
    return articleTextIndexCache;
}

// Resolves the closest existing Learn article for a symptom, then falls back to ID mapping.
function resolveArticleBySymptom(symptomId) {
    const hints = SYMPTOM_ARTICLE_HINTS[symptomId] || [];
    let bestArticle = null;
    let bestScore = 0;
    getArticleTextIndex().forEach(function(entry) {
        var haystack = entry.text;
        if (!haystack) return;
        var score = hints.reduce(function(total, hint) {
            return total + (haystack.includes(hint) ? 1 : 0);
        }, 0);
        if (score > bestScore) {
            bestScore = score;
            bestArticle = entry.article;
        }
    });
    if (bestArticle && bestScore > 0) return bestArticle;
    var fallbackArticleId = SYMPTOM_ARTICLE_MAP[symptomId];
    if (!fallbackArticleId) return null;
    return articles.find(function(a) { return a.id === fallbackArticleId; }) || null;
}

// Returns up to `symptomIds.length` real Learn article titles for the given symptom IDs.
// Titles are read from the articles array at call-time, so they stay current automatically.
function getLearnRecommendations(symptomIds) {
    if (!Array.isArray(symptomIds) || symptomIds.length === 0) return [];
    const seenIds = [];
    const titles = [];
    symptomIds.forEach(function(id) {
        const article = resolveArticleBySymptom(id);
        if (article && seenIds.indexOf(article.id) < 0) {
            seenIds.push(article.id);
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
            var presencePhrase = symptomLabels.length > 1 ? 'كانا حاضرَين' : 'كان حاضرًا';
            msg = 'بناءً على تسجيلك الأخير، لاحظت أن ' + labelPart + ' ' + presencePhrase + '. ';
            msg += titles.length === 1
                ? 'قد تجدين هذا المقال مفيدًا في قسم التعلم: \u201c' + titles[0] + '\u201d. لا ضغط على الإطلاق — أنا هنا متى كنتِ مستعدة.'
                : 'قد تجدين هذين المقالَين مفيدَين في قسم التعلم: \u201c' + titles[0] + '\u201d و\u201c' + titles[1] + '\u201d. لا ضغط — أنا هنا معك.';
        } else {
            var labelPartEn = symptomLabels.length > 1
                ? symptomLabels[0].toLowerCase() + ' and ' + symptomLabels[1].toLowerCase()
                : symptomLabels[0].toLowerCase();
            var haveHas = symptomLabels.length > 1 ? 'have' : 'has';
            msg = 'I noticed from your recent log that ' + labelPartEn + ' ' + haveHas + ' been present. ';
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
        { author: 'Sarah, 47', avatar: 'S', time: '2h ago', tag: 'Story', content: { en: "I finally went to my GP yesterday after months of hot flushes and night sweats. I was so nervous, but she listened and we talked about MHT. Feeling hopeful for the first time in ages.", ar: "ذهبت أخيرًا إلى طبيبي أمس بعد أشهر من الهبات الساخنة والتعرق الليلي. كنت عصبية جدًا، لكنها استمعت وتحدثنا عن MHT. أشعر بالأمل لأول مرة منذ وقت طويل." }},
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
