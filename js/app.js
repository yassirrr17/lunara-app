/* ==================== LUNARA APP ==================== */

const AppState = {
    user: null, isPremium: false, language: 'en', theme: 'light',
    messagesToday: 0, messageLimit: 3, currentScreen: 'onboarding',
    previousScreen: null, todayLog: null, logs: [], chatHistory: [], onboardingStep: 1
};

const Storage = {
    get(key) { try { return JSON.parse(localStorage.getItem('lunara_' + key)); } catch(e) { return null; } },
    set(key, value) { localStorage.setItem('lunara_' + key, JSON.stringify(value)); },
    clear() { Object.keys(localStorage).forEach(k => { if(k.startsWith('lunara_')) localStorage.removeItem(k); }); }
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
            logs.push({ date: d.toISOString().split('T')[0], mood: Math.floor(Math.random()*3)+2, sleep: Math.floor(Math.random()*5)+4, stress: Math.floor(Math.random()*3)+1, water: Math.floor(Math.random()*6)+3, symptoms: { 'brain-fog': Math.floor(Math.random()*3), 'hot-flashes': Math.floor(Math.random()*2), 'anxiety': Math.floor(Math.random()*3), 'sleep-issues': Math.floor(Math.random()*3), 'mood-swings': Math.floor(Math.random()*3), 'fatigue': Math.floor(Math.random()*3) }});
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
    if (screenId === 'chat') renderChat();
    if (screenId === 'settings') renderSettings();
}

function showMainApp() { document.getElementById('onboarding').classList.add('hidden'); document.getElementById('main-app').classList.remove('hidden'); document.getElementById('bottom-nav').classList.remove('hidden'); }
function showOnboarding() { document.getElementById('onboarding').classList.remove('hidden'); document.getElementById('main-app').classList.add('hidden'); document.getElementById('bottom-nav').classList.add('hidden'); }

let onboardingData = { age: '', symptoms: [], goals: [], sleep: 3, stress: 3, gp: '' };
function nextOnboardingStep() {
    const current = document.querySelector('.onboarding-step:not(.hidden)');
    const step = parseInt(current.dataset.step);
    if (step === 2 && !onboardingData.age) { shakeElement(current); return; }
    current.classList.add('hidden');
    const next = document.querySelector('.onboarding-step[data-step="' + (step+1) + '"]');
    if (next) { next.classList.remove('hidden'); AppState.onboardingStep = step+1; }
}
function finishOnboarding() {
    AppState.user = { name: 'Beautiful', age: onboardingData.age, symptoms: onboardingData.symptoms, goals: onboardingData.goals, joined: new Date().toISOString() };
    Storage.set('state', AppState); Storage.set('user', AppState.user);
    showMainApp(); renderHome();
    AppState.chatHistory = [{ from: 'luna', text: getText({ en: "Welcome to Lunara. I am Luna, and I am here to walk beside you through this. There is no rush, no judgment, and no such thing as a silly question. How are you feeling today?", ar: "مرحبًا بك في لونارا. أنا لونا، وأنا هنا لأمشي بجانبك خلال هذا. لا يوجد عجلة، ولا حكم، ولا يوجد شيء اسمه سؤال سخيف. كيف تشعرين اليوم؟" }), time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) }];
    Storage.set('chatHistory', AppState.chatHistory);
}
function shakeElement(el) { el.style.animation = 'none'; el.offsetHeight; el.style.animation = 'shake 0.4s ease'; }

document.addEventListener('click', (e) => {
    if (e.target.closest('.age-options .ob-option')) { document.querySelectorAll('.age-options .ob-option').forEach(btn => btn.classList.remove('selected')); const btn = e.target.closest('.age-options .ob-option'); btn.classList.add('selected'); onboardingData.age = btn.dataset.value; }
    if (e.target.closest('.symptom-options .ob-option')) { const btn = e.target.closest('.symptom-options .ob-option'); btn.classList.toggle('selected'); const val = btn.dataset.value; if (btn.classList.contains('selected')) { if (!onboardingData.symptoms.includes(val)) onboardingData.symptoms.push(val); } else { onboardingData.symptoms = onboardingData.symptoms.filter(s => s !== val); } }
    if (e.target.closest('.goal-options .ob-option')) { const btn = e.target.closest('.goal-options .ob-option'); btn.classList.toggle('selected'); const val = btn.dataset.value; if (btn.classList.contains('selected')) { if (!onboardingData.goals.includes(val)) onboardingData.goals.push(val); } else { onboardingData.goals = onboardingData.goals.filter(g => g !== val); } }
    if (e.target.closest('.ob-toggle')) { const btn = e.target.closest('.ob-toggle'); btn.parentElement.querySelectorAll('.ob-toggle').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); onboardingData.gp = btn.dataset.value; }
});

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
    const symptomTotal = Object.values(log.symptoms).reduce((a, b) => a + b, 0);
    score -= symptomTotal * 2;
    return Math.max(0, Math.min(100, Math.round(score)));
}

function getWellnessMessage(score, log) {
    const messages = { en: ["Today asks for gentleness. Rest is productive too.", "Your body is doing important work. Be patient with it.", "A softer day is still a good day. You are enough.", "Small steps count. You are taking care of yourself.", "You are finding your rhythm. That is beautiful.", "Your strength shows in showing up. Well done."], ar: ["اليوم يطلب اللطف. الراحة إنتاجية أيضًا.", "جسدك يقوم بعمل مهم. كني صبورة معه.", "اليوم الهادئ لا يزال يومًا جيدًا. أنتِ كافية.", "الخطوات الصغيرة تحتسب. أنتِ تهتمين بنفسك.", "أنتِ تجدين إيقاعك. هذا جميل.", "قوتك تظهر في حضورك. أحسنتِ."] };
    return messages[AppState.language][Math.min(Math.floor(score / 20), 5)];
}

function getHormoneInsight(log) {
    const insights = { en: ["Oestrogen naturally lower this week — expect softer energy in the afternoons.", "Your cortisol pattern suggests a gentle morning walk would help today.", "Progesterone shifts may be making sleep lighter — a warm bath after dinner could help.", "Your tracking shows stress peaks around 3pm — try a breathing break then.", "Hydration is supporting your hormone transport today. Keep it up."], ar: ["الإستروجين منخفض طبيعيًا هذا الأسبوع - توقعي طاقة ألين في بعد الظهر.", "نمط الكورتيزول لديك يشير إلى أن نزهة صباحية لطيفة ستساعد اليوم.", "تقلبات البروجسترون قد تجعل النوم أخف - حمام دافئ بعد العشاء قد يساعد.", "تتبعك يظهر ذروات التوتر حوالي الساعة 3 مساءً - جربي استراحة تنفس حينها.", "الترطيب يدعم نقل هرموناتك اليوم. استمري."] };
    return insights[AppState.language][Math.floor(Math.random() * insights[AppState.language].length)];
}

const symptomConfig = [
    { id: 'brain-fog', label: { en: 'Brain fog', ar: 'ضباب الدماغ' }, color: '#C8B8DB' },
    { id: 'hot-flashes', label: { en: 'Hot flashes', ar: 'الهبات الساخنة' }, color: '#E8B4B8' },
    { id: 'anxiety', label: { en: 'Anxiety', ar: 'القلق' }, color: '#F5D5C0' },
    { id: 'mood-swings', label: { en: 'Mood swings', ar: 'تقلبات المزاج' }, color: '#B8C9B8' },
    { id: 'sleep-issues', label: { en: 'Sleep', ar: 'النوم' }, color: '#A8C4D9' },
    { id: 'fatigue', label: { en: 'Fatigue', ar: 'الإرهاق' }, color: '#D4C4B0' }
];

function renderTracker() {
    const logs = Storage.get('logs') || [];
    const today = new Date().toISOString().split('T')[0];
    let todayLog = logs.find(l => l.date === today);
    if (!todayLog) {
        todayLog = { date: today, mood: 3, sleep: 6, stress: 3, water: 5, symptoms: {} };
        symptomConfig.forEach(s => todayLog.symptoms[s.id] = 0);
    }
    AppState.todayLog = todayLog;
    renderWeeklyChart(logs);
    document.getElementById('track-mood').value = todayLog.mood;
    document.getElementById('track-sleep').value = todayLog.sleep;
    document.getElementById('track-stress').value = todayLog.stress;
    document.getElementById('track-water').value = todayLog.water;
    updateSliderLabels();
    const symptomList = document.getElementById('symptom-list');
    symptomList.innerHTML = symptomConfig.map(s => '<div class="symptom-item"><div class="symptom-header"><div class="symptom-name"><span class="symptom-dot" style="background:' + s.color + '"></span><span>' + s.label[AppState.language] + '</span></div><span class="symptom-value" id="symptom-val-' + s.id + '">' + todayLog.symptoms[s.id] + '/5</span></div><div class="symptom-scale">' + [0,1,2,3,4,5].map(n => '<button class="scale-btn ' + (todayLog.symptoms[s.id] === n ? 'selected' : '') + '" onclick="setSymptom(\'' + s.id + '\', ' + n + ')" data-symptom="' + s.id + '" data-value="' + n + '">' + n + '</button>').join('') + '</div></div>').join('');
}

function renderWeeklyChart(logs) {
    const chart = document.getElementById('weekly-chart');
    const days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
    chart.innerHTML = days.map((d, i) => {
        const dateStr = d.toISOString().split('T')[0];
        const log = logs.find(l => l.date === dateStr);
        const height = log ? (log.mood / 5 * 80) + 10 : 10;
        const isToday = i === 6;
        return '<div class="chart-bar-wrapper"><div class="chart-bar ' + (isToday ? 'today' : '') + '" style="height: 80px;"><div class="chart-bar-fill" style="height: ' + height + '%"></div>' + (isToday ? '<div class="chart-dot"></div>' : '') + '</div><span class="chart-label">' + d.getDate() + '</span></div>';
    }).join('');
}

function updateSliderLabels() {
    document.getElementById('val-mood').textContent = document.getElementById('track-mood').value + '/5';
    document.getElementById('val-sleep').textContent = document.getElementById('track-sleep').value + 'h';
    document.getElementById('val-stress').textContent = document.getElementById('track-stress').value + '/5';
    document.getElementById('val-water').textContent = document.getElementById('track-water').value + ' glasses';
}

function setSymptom(symptomId, value) {
    if (!AppState.todayLog) return;
    AppState.todayLog.symptoms[symptomId] = value;
    document.querySelectorAll('[data-symptom="' + symptomId + '"]').forEach(btn => btn.classList.toggle('selected', parseInt(btn.dataset.value) === value));
    document.getElementById('symptom-val-' + symptomId).textContent = value + '/5';
}

function saveTracker() {
    if (!AppState.todayLog) return;
    AppState.todayLog.mood = parseInt(document.getElementById('track-mood').value);
    AppState.todayLog.sleep = parseFloat(document.getElementById('track-sleep').value);
    AppState.todayLog.stress = parseInt(document.getElementById('track-stress').value);
    AppState.todayLog.water = parseInt(document.getElementById('track-water').value);
    let logs = Storage.get('logs') || [];
    logs = logs.filter(l => l.date !== AppState.todayLog.date);
    logs.push(AppState.todayLog);
    Storage.set('logs', logs); AppState.logs = logs;
    const btn = document.querySelector('.btn-save');
    const original = btn.innerHTML;
    btn.innerHTML = '<span>' + getText({en: 'Saved ✓', ar: 'تم الحفظ ✓'}) + '</span>';
    btn.style.background = 'var(--sage)';
    setTimeout(() => { btn.innerHTML = original; btn.style.background = ''; }, 1500);
    renderHome();
}

document.addEventListener('input', (e) => { if (e.target.classList.contains('tracker-slider')) updateSliderLabels(); });

function renderInsights() {
    const container = document.getElementById('insights-container');
    const logs = Storage.get('logs') || [];
    if (logs.length < 3) {
        container.innerHTML = '<div class="insight-card"><div class="insight-icon" style="background: var(--lavender-light)">&#127807;</div><div class="insight-content"><h4>' + getText({en: 'Keep tracking', ar: 'استمري في التتبع'}) + '</h4><p>' + getText({en: 'Log a few more days and I will start spotting patterns for you.', ar: 'سجلي بضعة أيام أخرى وسأبدأ في ملاحظة الأنماط لك.'}) + '</p></div></div>';
        return;
    }
    const insights = generateInsights(logs);
    container.innerHTML = insights.map(insight => '<div class="insight-card"><div class="insight-icon" style="background: ' + insight.bg + '">' + insight.icon + '</div><div class="insight-content"><h4>' + insight.title + '</h4><p>' + insight.text + '</p><span class="insight-tag">' + insight.tag + '</span></div></div>').join('');
}

function generateInsights(logs) {
    const recent = logs.slice(-7);
    const avgMood = recent.reduce((a, l) => a + l.mood, 0) / recent.length;
    const avgSleep = recent.reduce((a, l) => a + l.sleep, 0) / recent.length;
    const avgStress = recent.reduce((a, l) => a + l.stress, 0) / recent.length;
    const insights = [];
    if (avgSleep < 5.5) {
        insights.push({ icon: '&#127769;', bg: 'var(--lavender-light)', title: getText({en: 'Sleep pattern detected', ar: 'نمط النوم مكتشف'}), text: getText({ en: "Your sleep has averaged under 6 hours this week. In perimenopause, progesterone dips can make falling asleep harder. A magnesium-rich snack like a handful of almonds or a warm cup of chamomile before bed might help your body wind down.", ar: "لقد كان متوسط نومك أقل من 6 ساعات هذا الأسبوع. في فترة ما قبل انقطاع الطمث، يمكن أن يجعل انخفاض البروجسترون النوم أصعب. وجبة خفيفة غنية بالمغنيسيوم مثل حفنة من اللوز أو كوب دافئ من البابونج قبل النوم قد يساعد جسمك على الاسترخاء." }), tag: getText({en: 'Sleep', ar: 'النوم'}) });
    }
    if (avgStress > 3.5) {
        insights.push({ icon: '&#x1F30A;', bg: 'var(--peach-light)', title: getText({en: 'Stress is running high', ar: 'التوتر مرتفع'}), text: getText({ en: "I have noticed your stress levels creeping up. This is not weakness — your adrenal glands are working overtime while your oestrogen shifts. Even five minutes of box breathing on the back deck, or a quiet coastal walk, can signal safety to your nervous system.", ar: "لاحظت أن مستويات التوتر لديك في ارتفاع. هذا ليس ضعفًا - غددك الكظرية تعمل بجد بينما يتغير الإستروجين لديك. حتى خمس دقائق من التنفس المربع على الشرفة الخلفية، أو نزهة هادئة على الساحل، يمكن أن تشير الأمان إلى جهازك العصبي." }), tag: getText({en: 'Stress', ar: 'التوتر'}) });
    }
    if (avgMood < 3) {
        insights.push({ icon: '&#9786;', bg: 'var(--rose-light)', title: getText({en: 'Your mood needs nurturing', ar: 'مزاجك يحتاج إلى رعاية'}), text: getText({ en: "Low mood scores this week. Please be gentle with yourself. The hormonal rollercoaster of perimenopause is real, and it affects brain chemistry. If this persists, speaking with your GP is a brave and wise step. You do not have to carry this alone.", ar: "درجات مزاج منخفضة هذا الأسبوع. من فضلك كوني لطيفة مع نفسك. الأفعوانية الهرمونية لما قبل انقطاع الطمث حقيقية، وتؤثر على كيمياء الدماغ. إذا استمر هذا، فإن التحدث مع طبيبك العام هو خطوة شجاعة وحكيمة. لا يجب أن تحملي هذا وحدك." }), tag: getText({en: 'Mood', ar: 'المزاج'}) });
    }
    insights.push({ icon: '&#128161;', bg: 'var(--sage-light)', title: getText({en: 'Your hydration is helping', ar: 'ترطيبك يساعد'}), text: getText({ en: "Water supports every hormone conversation happening in your body right now. If you are forgetting to drink, try keeping a bottle by the kettle. Warm lemon water in the morning is lovely during our cooler Southern Hemisphere months.", ar: "الماء يدعم كل محادثة هرمونية تحدث في جسمك الآن. إذا كنتِ تنسين الشرب، جربي الاحتفاظ بزجاجة بجانب الغلاية. ماء الليمون الدافئ في الصباح جميل خلال أشهر نصف الكرة الجنوبي الأكثر برودة." }), tag: getText({en: 'Hydration', ar: 'الترطيب'}) });
    return insights;
}

function renderDailyPlan() {
    const container = document.getElementById('daily-plan-container');
    const plan = generateDailyPlan();
    container.innerHTML = plan.sections.map(section => '<div class="plan-section"><div class="plan-section-header"><div class="plan-section-icon" style="background: ' + section.iconBg + '">' + section.icon + '</div><span class="plan-section-title">' + section.title + '</span></div>' + section.items.map(item => '<div class="plan-item" onclick="togglePlanItem(this)"><div class="plan-check ' + (item.done ? 'checked' : '') + '"></div><div class="plan-text"><h4>' + item.name + '</h4><p>' + item.desc + '</p></div></div>').join('') + '</div>').join('');
}

function generateDailyPlan() {
    const lang = AppState.language;
    const plans = {
        en: { sections: [
            { icon: '&#9728;', iconBg: 'var(--peach-light)', title: 'Morning', items: [
                { name: 'Gentle wake-up', desc: 'No phone for 10 minutes. Open a window if you can.', done: false },
                { name: 'Warm lemon water', desc: 'Before coffee or tea. Hydration supports hormone transport.', done: false },
                { name: 'Five-minute stretch', desc: 'Neck rolls, shoulder shrugs, gentle spinal twist.', done: false }
            ]},
            { icon: '&#127807;', iconBg: 'var(--sage-light)', title: 'Nutrition', items: [
                { name: 'Protein at every meal', desc: 'Eggs, salmon, lentils, or Greek yoghurt. Supports muscle and mood.', done: false },
                { name: 'Add healthy fats', desc: 'Avocado, olive oil, or a handful of walnuts.', done: false },
                { name: 'Limit caffeine after 2pm', desc: 'Your adrenals will thank you.', done: false }
            ]},
            { icon: '&#9829;', iconBg: 'var(--rose-light)', title: 'Movement', items: [
                { name: '20-minute coastal walk or bush track', desc: 'Gentle cardio without stressing your joints.', done: false },
                { name: 'Pelvic floor exercises', desc: 'Three sets of ten. Protects against leaks as oestrogen drops.', done: false }
            ]},
            { icon: '&#127769;', iconBg: 'var(--lavender-light)', title: 'Evening Wind-Down', items: [
                { name: 'Dim lights at 8pm', desc: 'Signals melatonin production.', done: false },
                { name: 'No screens 30 min before bed', desc: 'Read, stretch, or chat with someone you love.', done: false },
                { name: 'Magnesium spray or bath', desc: 'Eases muscle tension and supports deeper sleep.', done: false }
            ]}
        ]},
        ar: { sections: [
            { icon: '&#9728;', iconBg: 'var(--peach-light)', title: 'الصباح', items: [
                { name: 'استيقاظ لطيف', desc: 'لا هاتف لمدة 10 دقائق. افتحي النافذة إذا أمكن.', done: false },
                { name: 'ماء دافئ بالليمون', desc: 'قبل القهوة أو الشاي. الترطيب يدعم نقل الهرمونات.', done: false },
                { name: 'تمدد لمدة خمس دقائق', desc: 'لف الرقبة، رفع الكتفين، لي العمود الفقري بلطف.', done: false }
            ]},
            { icon: '&#127807;', iconBg: 'var(--sage-light)', title: 'التغذية', items: [
                { name: 'بروتين في كل وجبة', desc: 'بيض، سلمون، عدس، أو زبادي يوناني. يدعم العضلات والمزاج.', done: false },
                { name: 'أضيفي دهون صحية', desc: 'أفوكادو، زيت زيتون، أو حفنة من الجوز.', done: false },
                { name: 'قللي الكافيين بعد الساعة 2', desc: 'غددك الكظرية ستشكرك.', done: false }
            ]},
            { icon: '&#9829;', iconBg: 'var(--rose-light)', title: 'الحركة', items: [
                { name: '20 دقيقة مشي على الساحل أو مسار الغابة', desc: ' cardio لطيف بدون إجهاد مفاصلك.', done: false },
                { name: 'تمارين قاع الحوض', desc: 'ثلاث مجموعات من عشرة. تحمي من التسرب مع انخفاض الإستروجين.', done: false }
            ]},
            { icon: '&#127769;', iconBg: 'var(--lavender-light)', title: 'الاسترخاء المسائي', items: [
                { name: 'خفتي الأضواء الساعة 8 مساءً', desc: 'يشير إلى إنتاج الميلاتونين.', done: false },
                { name: 'لا شاشات قبل النوم بـ 30 دقيقة', desc: 'اقرئي، تمددي، أو تحدثي مع شخص تحبينه.', done: false },
                { name: 'بخاخ أو حمام مغنيسيوم', desc: 'يريح توتر العضلات ويدعم نومًا أعمق.', done: false }
            ]}
        ]}
    };
    return plans[lang];
}

function togglePlanItem(el) { el.querySelector('.plan-check').classList.toggle('checked'); }

const communityPosts = {
    stories: [
        { author: 'Sarah, 47', avatar: 'S', time: '2h ago', tag: 'Story', content: { en: "I finally went to my GP yesterday after months of hot flashes and night sweats. I was so nervous, but she was lovely. We are starting with some bloods and looking at HRT options. If you are on the fence about going, please do it. You deserve answers.", ar: "أخيرًا ذهبت إلى طبيبي العام أمس بعد أشهر من الهبات الساخنة والتعرق الليلي. كنتُ قلقة جدًا، لكنها كانت لطيفة. سنبدأ ببعض التحاليل وننظر في خيارات HRT. إذا كنتِ مترددة حول الذهاب، من فضلكِ افعلي ذلك. أنتِ تستحقين إجابات." }, likes: 24, comments: 8 },
        { author: 'Anonymous', avatar: 'A', time: '5h ago', tag: 'Support', content: { en: "Does anyone else feel like their brain has been replaced with cotton wool? I forgot my own address yesterday. I laughed but inside I was terrified. My friend said it is normal in perimenopause but I feel so alone.", ar: "هل تشعر أي منكن بأن دماغها استُبدل بالقطن؟ نسيت عنواني أمس. ضحكتُ لكن في الداخل كنتُ مرعوبة. قالت صديقتي إنه طبيعي في فترة ما قبل انقطاع الطمث لكنني أشعر بالوحدة الشديدة." }, likes: 56, comments: 19 },
        { author: 'Mara, 52', avatar: 'M', time: '1d ago', tag: 'Win', content: { en: "Three weeks of daily coastal walks and my sleep has improved so much. I still wake up once or twice but I fall back asleep now. Small win but it feels huge. Keep going everyone.", ar: "ثلاثة أسابيع من المشي اليومي على الساحل وقد تحسن نومي كثيرًا. ما زلتُ أستيقظ مرة أو مرتين لكنني أعود للنوم الآن. فوز صغير لكنه يبدو ضخمًا. استمري الجميع." }, likes: 89, comments: 12 }
    ],
    expert: [
        { author: 'Dr. Emma Walsh', avatar: 'E', time: '1d ago', tag: 'Expert', content: { en: "A gentle reminder: brain fog in perimenopause is real and it is biochemical, not personal failure. Oestrogen receptors exist throughout your brain, including areas responsible for memory and focus. When levels fluctuate, so does cognitive clarity. Be patient with yourself.", ar: "تذكير لطيف: ضباب الدماغ في فترة ما قبل انقطاع الطمث حقيقي وهو كيميائي حيوي، ليس فشلًا شخصيًا. مستقبلات الإستروجين موجودة في جميع أنحاء دماغك، بما في ذلك المناطق المسؤولة عن الذاكرة والتركيز. عندما تتقلب المستويات، يتقلب الوضوح الإدراكي أيضًا. كوني صبورة مع نفسك." }, likes: 134, comments: 31 }
    ],
    support: [
        { author: 'Jen, 44', avatar: 'J', time: '3h ago', tag: 'Support', content: { en: "To whoever needs to hear this today: you are not broken. Your body is transitioning, not failing. The anxiety, the rage, the tears — they are symptoms, not character flaws. Be as kind to yourself as you would be to your best friend.", ar: "لمن تحتاج سماع هذا اليوم: أنتِ لست مكسورة. جسدك في انتقال، لا يفشل. القلق، الغضب، الدموع - هي أعراض، ليس عيوب شخصية. كوني لطيفة مع نفسك كما كنتِ ستكونين مع صديقتك المقربة." }, likes: 212, comments: 45 }
    ]
};

function renderCommunity(tab) {
    document.querySelectorAll('.comm-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    const feed = document.getElementById('community-feed');
    const posts = communityPosts[tab] || communityPosts.stories;
    feed.innerHTML = posts.map(post => '<div class="community-post"><div class="post-header"><div class="post-avatar">' + post.avatar + '</div><div class="post-meta"><div class="post-author">' + post.author + '</div><div class="post-time">' + post.time + '</div></div><span class="post-tag">' + post.tag + '</span></div><div class="post-content">' + post.content[AppState.language] + '</div><div class="post-actions"><button class="post-action" onclick="this.style.color=\'var(--rose-dark)\'">&#9829; ' + post.likes + '</button><button class="post-action">&#128172; ' + post.comments + '</button><button class="post-action">&#8618; Share</button></div></div>').join('');
}

document.addEventListener('click', (e) => { if (e.target.closest('.comm-tab')) renderCommunity(e.target.closest('.comm-tab').dataset.tab); });

const articles = [
    { id: 1, filter: 'all', title: { en: 'The three stages of menopause, gently explained', ar: 'المراحل الثلاث لانقطاع الطمث، موضحة بلطف' }, readTime: '4 min', featured: true,
      content: { en: '<div class="article-hero"><h1>The three stages of menopause, gently explained</h1></div><div class="article-body"><p>Menopause is not a single event. It is a journey with three distinct stages, and understanding them can help you feel more in control and less confused.</p><h3>Perimenopause</h3><p>This is the transition period, usually starting in your 40s but sometimes earlier. Your ovaries gradually produce less oestrogen, and periods become irregular. Symptoms like hot flashes, mood swings, brain fog, and sleep disruption often begin here. This stage can last anywhere from a few months to over ten years.</p><h3>Menopause</h3><p>Menopause is officially diagnosed when you have not had a period for 12 consecutive months. The average age in New Zealand and Australia is around 51. At this point, your ovaries have stopped releasing eggs and oestrogen production drops significantly.</p><h3>Post-menopause</h3><p>This is the stage after menopause. Many symptoms ease, but the lower oestrogen levels can affect bone density, heart health, and vaginal comfort. This is why ongoing care with your GP matters.</p><div class="article-cta"><p>Want personalised insights based on your own journey?</p><button class="btn-primary" onclick="navigateTo(\'premium\'); goBackFromArticle();">Explore Premium</button></div></div>' } },
    { id: 2, filter: 'peri', title: { en: 'Why brain fog is real (and what helps)', ar: 'لماذا ضباب الدماغ حقيقي (وما يساعد)' }, readTime: '5 min',
      content: { en: '<div class="article-hero" style="background:linear-gradient(135deg, var(--sage-light), var(--lavender-light))"><h1>Why brain fog is real</h1></div><div class="article-body"><p>If you have walked into a room and forgotten why, or struggled to find a word that is usually on the tip of your tongue, you are not imagining it. Brain fog in perimenopause is well-documented and biochemically explained.</p><h3>The oestrogen-brain connection</h3><p>Oestrogen receptors are found in areas of the brain responsible for memory, attention, and verbal processing. When oestrogen levels fluctuate, neurotransmitter activity changes. This affects how quickly you can recall information and how clearly you can focus.</p><h3>What helps</h3><ul><li><strong>Sleep hygiene:</strong> Prioritise 7-8 hours. Even one bad night worsens cognitive function.</li><li><strong>Omega-3s:</strong> Found in salmon, sardines, and walnuts. Support brain cell membranes.</li><li><strong>Exercise:</strong> Even a 20-minute walk increases blood flow to the brain.</li><li><strong>Lists and reminders:</strong> Externalise your memory. It is not cheating; it is smart.</li></ul></div>' } },
    { id: 3, filter: 'menopause', title: { en: 'Hot flashes: the science of the sudden heat', ar: 'الهبات الساخنة: علم الحرارة المفاجئة' }, readTime: '3 min',
      content: { en: '<div class="article-hero" style="background:linear-gradient(135deg, var(--rose-light), var(--peach-light))"><h1>Hot flashes: the science</h1></div><div class="article-body"><p>Hot flashes are the most recognised symptom of menopause, and they are caused by a misfire in your body\'s thermostat.</p><h3>What is happening</h3><p>Your hypothalamus, the part of your brain that regulates body temperature, becomes more sensitive to slight changes in core temperature due to dropping oestrogen. It mistakenly thinks you are overheating and triggers sweating, flushing, and a rapid heart rate to cool you down.</p><h3>Triggers to watch</h3><ul><li>Spicy foods and hot drinks</li><li>Alcohol, especially red wine</li><li>Stress and anxiety</li><li>Warm environments or layered clothing</li><li>Caffeine on an empty stomach</li></ul></div>' } },
    { id: 4, filter: 'peri', title: { en: 'Rebuilding sleep when hormones shift', ar: 'إعادة بناء النوم عندما تتغير الهرمونات' }, readTime: '4 min',
      content: { en: '<div class="article-hero" style="background:linear-gradient(135deg, var(--lavender-light), var(--sage-light))"><h1>Rebuilding sleep</h1></div><div class="article-body"><p>Sleep disruption is one of the most frustrating symptoms of perimenopause. You are exhausted but wired, or you fall asleep only to wake at 3am with your mind racing.</p><h3>Why it happens</h3><p>Progesterone has a calming, sedative effect on the brain. As it declines, falling asleep becomes harder. Meanwhile, cortisol (your stress hormone) can spike in the early hours, jolting you awake.</p><h3>A sleep-friendly evening</h3><ul><li>Finish eating 3 hours before bed</li><li>Take a warm bath with magnesium salts</li><li>Keep your bedroom cool — around 18°C</li><li>Use breathable cotton bedding</li><li>Try a guided sleep meditation if your mind is busy</li></ul></div>' } },
    { id: 5, filter: 'post', title: { en: 'Nutrition after 40: the quiet upgrade', ar: 'التغذية بعد 40: الترقية الهادئة' }, readTime: '4 min',
      content: { en: '<div class="article-hero" style="background:linear-gradient(135deg, var(--peach-light), var(--rose-light))"><h1>Nutrition after 40</h1></div><div class="article-body"><p>Your nutritional needs shift in your 40s and 50s, not dramatically, but meaningfully. Small upgrades to your daily plate can support energy, mood, bone health, and hormone balance.</p><h3>Protein becomes non-negotiable</h3><p>Aim for protein at every meal. Think eggs at breakfast, salmon or chicken at lunch, lentils or tofu at dinner. As oestrogen drops, muscle mass declines more easily. Protein protects it.</p><h3>Calcium and vitamin D</h3><p>Bone density becomes a priority post-menopause. Include dairy, fortified plant milks, leafy greens, and tinned salmon with bones. In New Zealand and Australia, vitamin D from sunshine is helpful, but many women still need supplementation — ask your GP for a blood test.</p><h3>Healthy fats for brain and mood</h3><p>Avocado, olive oil, nuts, and oily fish support brain function and help stabilise mood swings. A handful of walnuts or a drizzle of olive oil over roasted kumara is a simple win.</p></div>' } }
];

function renderEducation(filter) {
    document.querySelectorAll('.edu-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === filter));
    const feed = document.getElementById('education-feed');
    const filtered = filter === 'all' ? articles : articles.filter(a => a.filter === filter || a.filter === 'all');
    const featured = filtered.find(a => a.featured);
    const regular = filtered.filter(a => !a.featured);
    let html = '';
    if (featured) {
        html += '<div class="edu-featured" onclick="openArticle(' + featured.id + ')"><span class="edu-featured-badge">Featured</span><div class="edu-featured-text"><h3>' + featured.title[AppState.language] + '</h3><span>' + featured.readTime + ' read</span></div></div>';
    }
    html += '<div class="edu-grid">' + regular.map(a => '<div class="edu-card" onclick="openArticle(' + a.id + ')"><div class="edu-card-img">&#128218;</div><div class="edu-card-body"><h4>' + a.title[AppState.language] + '</h4><span>' + a.readTime + ' read</span></div></div>').join('') + '</div>';
    feed.innerHTML = html;
}

document.addEventListener('click', (e) => { if (e.target.closest('.edu-tab')) renderEducation(e.target.closest('.edu-tab').dataset.filter); });

function openArticle(id) {
    const article = articles.find(a => a.id === id);
    if (!article) return;
    const content = article.content[AppState.language] || article.content['en'];
    document.getElementById('article-content').innerHTML = content;
    navigateTo('article');
}
function goBackFromArticle() { navigateTo('education'); }

function renderChat() {
    const container = document.getElementById('chat-messages');
    const history = AppState.chatHistory || [];
    container.innerHTML = history.map(msg => '<div class="message message-' + msg.from + '"><div class="message-bubble">' + msg.text + '</div><div class="message-time">' + msg.time + '</div></div>').join('');
    container.scrollTop = container.scrollHeight;
    updateChatLimit();
}

function updateChatLimit() {
    const limitEl = document.getElementById('chat-limit');
    const remaining = AppState.isPremium ? 'Unlimited' : (AppState.messageLimit - AppState.messagesToday) + '/' + AppState.messageLimit;
    limitEl.textContent = getText({ en: remaining + ' messages today', ar: remaining + ' رسائل اليوم' });
    if (!AppState.isPremium && AppState.messagesToday >= AppState.messageLimit) {
        document.getElementById('chat-input').disabled = true;
        document.getElementById('chat-input').placeholder = getText({ en: 'Upgrade to Premium for unlimited chat', ar: 'ارتقي إلى البريميوم للدردشة غير المحدودة' });
    }
}

function sendQuickMessage(btn) { document.getElementById('chat-input').value = btn.textContent; sendMessage(); }

function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    if (!AppState.isPremium && AppState.messagesToday >= AppState.messageLimit) { showPremiumModal(); return; }
    const userMsg = { from: 'user', text: text, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) };
    AppState.chatHistory.push(userMsg);
    if (!AppState.isPremium) AppState.messagesToday++;
    Storage.set('chatHistory', AppState.chatHistory); Storage.set('state', AppState);
    input.value = ''; renderChat(); updateChatLimit();
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
        return getText({ en: "I would love to go deeper on this for you. The full analysis and your personalised health report are waiting inside Premium. In the meantime, I can share that tracking your symptoms daily helps us both see the bigger picture. Would you like help with anything else today?", ar: "أحب أن أتعمق في هذا معك. التحليل الكامل وتقريرك الصحي المخصص ينتظرانك في البريميوم. في الوقت الحالي، يمكنني أن أشارك أن تتبع أعراضك يوميًا يساعدنا كلانا على رؤية الصورة الأكبر. هل تريدين مساعدة في أي شيء آخر اليوم؟" });
    }
    if (lower.includes('tired') || lower.includes('exhausted') || lower.includes('fatigue') || lower.includes('energy')) {
        return getText({ en: "I hear you. The exhaustion of perimenopause is different from ordinary tiredness — it is cellular. Your mitochondria, the powerhouses of your cells, are affected by shifting oestrogen. Here is what often helps: protein within an hour of waking, a short walk outside even when you do not feel like it, and saying no to one thing today. You are not lazy. Your body is recalibrating.", ar: "أسمعك. إرهاق فترة ما قبل انقطاع الطمث مختلف عن التعب العادي - إنه خلوي. تتأثر الميتوكوندريا، محطات طاقة خلاياك، بتقلب الإستروجين. إليك ما يساعد غالبًا: البروتين خلال ساعة من الاستيقاظ، نزهة قصيرة في الخارج حتى عندما لا تشعرين برغبة في ذلك، وقول لا لشيء واحد اليوم. أنتِ لست كسولة. جسدك يعيد المعايرة." });
    }
    if (lower.includes('sleep') || lower.includes('insomnia') || lower.includes('wake') || lower.includes('night')) {
        return getText({ en: "Sleep disruption is one of the cruellest symptoms because everything feels harder without rest. Progesterone, which helps us feel sleepy, is dropping. Cortisol, which wakes us up, can spike at 3am. Try this tonight: no screens after 8pm, a small snack with tryptophan (banana with peanut butter, or warm milk), and keep your room at 18°C. If sleepless nights persist for more than a few weeks, your GP can help. You do not need to suffer in silence.", ar: "اضطراب النوم هو واحد من أقسى الأعراض لأن كل شيء يبدو أصعب بدون راحة. البروجسترون، الذي يساعدنا على الشعور بالنعاس، ينخفض. الكورتيزول، الذي يوقظنا، قد يرتفع الساعة 3 صباحًا. جربي هذا الليلة: لا شاشات بعد الساعة 8 مساءً، وجبة خفيفة صغيرة مع التريبتوفان (موز مع زبدة الفول السوداني، أو حليب دافئ)، وأبقي غرفتك عند 18 درجة مئوية. إذا استمرت الليالي بلا نوم لأكثر من بضعة أسابيع، يمكن لطبيبك العام المساعدة. لا حاجة للمعاناة في صمت." });
    }
    if (lower.includes('anxious') || lower.includes('anxiety') || lower.includes('worry') || lower.includes('panic')) {
        return getText({ en: "Anxiety in perimenopause can feel like it came out of nowhere. One day you were fine, the next your heart is racing over nothing. This is not in your head — it is in your hormones. Oestrogen helps regulate cortisol and serotonin. When it drops, your nervous system becomes more reactive. Grounding techniques help: 5-4-3-2-1 senses exercise, slow box breathing, or even splashing cold water on your face. And please, if anxiety is interfering with your daily life, reach out to 1737 in NZ or Lifeline in Australia. You matter.", ar: "القلق في فترة ما قبل انقطاع الطمث يمكن أن يبدو وكأنه جاء من العدم. في يوم كنتِ بخير، وفي اليوم التالي قلبك يدق بسرعة من لا شيء. هذا ليس في رأسك - إنه في هرموناتك. الإستروجين يساعد في تنظيم الكورتيزول والسيروتونين. عندما ينخفض، يصبح جهازك العصبي أكثر تفاعلًا. تقنيات التأريض تساعد: تمرين الحواس 5-4-3-2-1، التنفس البطيء المربع، أو حتى رش الماء البارد على وجهك. ومن فضلكِ، إذا كان القلق يتداخل مع حياتك اليومية، تواصلي مع 1737 في نيوزيلندا أو لايفلاين في أستراليا. أنتِ تهمين." });
    }
    if (lower.includes('hot') || lower.includes('flush') || lower.includes('sweat') || lower.includes('night sweat')) {
        return getText({ en: "Hot flashes happen because your hypothalamus — your internal thermostat — becomes oversensitive. A tiny rise in core temperature triggers a full cooling response: sweating, flushing, racing heart. Dress in layers you can peel off, avoid red wine and spicy food in the evening, and keep a cool drink by your bed. Some women find relief with sage tea or black cohosh, but always check with your GP before trying supplements, especially if you are on other medications.", ar: "تحدث الهبات الساخنة لأن تحت المهاد - منظم حرارتك الداخلي - يصبح شديد الحساسية. ارتفاع طفيف في درجة حرارة الجسم الأساسية يطلق استجابة تبريد كاملة: التعرق، الاحمرار، تسارع القلب. ارتدي طبقات يمكنك خلعها، تجنبي النبيذ الأحمر والطعام الحار في المساء، وأبقي مشروبًا باردًا بجانب سريرك. تجد بعض النساء الراحة مع شاي المريمية أو كوهوش الأسود، لكن تحققي دائمًا من طبيبك العام قبل تجربة المكملات، خاصة إذا كنتِ على أدوية أخرى." });
    }
    if (lower.includes('brain fog') || lower.includes('forget') || lower.includes('memory') || lower.includes('concentrate') || lower.includes('focus')) {
        return getText({ en: "Brain fog is real, and it is not a sign you are losing your mind. Oestrogen supports acetylcholine, a neurotransmitter crucial for memory and learning. When levels fluctuate, so does your cognitive clarity. The good news: it usually improves post-menopause. In the meantime, externalise your memory — use lists, set phone reminders, and do not multitask. Omega-3s from salmon or walnuts, and regular exercise, both support brain health. Be patient. This is temporary.", ar: "ضباب الدماغ حقيقي، وليس علامة على أنك تفقدين عقلك. الإستروجين يدعم الأستيل كولين، ناقل عصبي حاسم للذاكرة والتعلم. عندما تتقلب المستويات، يتقلب وضوحك الإدراكي أيضًا. الخبر السار: عادة ما يتحسن بعد انقطاع الطمث. في الوقت الحالي، اجعلي ذاكرتك خارجية - استخدمي القوائم، ضعي تذكيرات الهاتف، ولا تقومي بمهام متعددة في آن واحد. أوميغا 3 من السلمون أو الجوز، والتمارين الرياضية المنتظمة، كلاهما يدعم صحة الدماغ. كوني صبورة. هذا مؤقت." });
    }
    if (lower.includes('gp') || lower.includes('doctor') || lower.includes('hrt') || lower.includes('hormone replacement')) {
        return getText({ en: "Speaking with your GP is a brave and important step. In New Zealand and Australia, many GPs are well-trained in menopause care, though not all. You can ask for a longer appointment to discuss symptoms properly. HRT is one option, but it is not the only one. Lifestyle changes, non-hormonal medications, and complementary therapies all have a place. Write down your symptoms before you go, and bring your Lunara tracking data. You deserve to be heard.", ar: "التحدث مع طبيبك العام هو خطوة شجاعة ومهمة. في نيوزيلندا وأستراليا، العديد من الأطباء العامين مدربون جيدًا في رعاية انقطاع الطمث، لكن ليس جميعهم. يمكنك طلب موعد أطول لمناقشة الأعراض بشكل صحيح. HRT هو أحد الخيارات، لكنه ليس الوحيد. تغييرات نمط الحياة، الأدوية غير الهرمونية، والعلاجات التكميلية كلها لها مكان. اكتبي أعراضك قبل الذهاب، وأحضري بيانات التتبع الخاصة بك من لونارا. أنتِ تستحقين أن يُسمع صوتك." });
    }
    if (lower.includes('food') || lower.includes('eat') || lower.includes('diet') || lower.includes('nutrition') || lower.includes('weight')) {
        return getText({ en: "Nutrition in perimenopause is about nourishment, not restriction. Your body needs more protein than before — aim for it at every meal. Think eggs, Greek yoghurt, salmon, chicken, or lentils. Healthy fats matter too: avocado, olive oil, walnuts, and feijoa when it is in season. Try roasted kumara with a drizzle of olive oil — it is comforting and nutrient-dense. And please, do not skip carbs entirely. Your brain needs them. Whole grains, not punishment.", ar: "التغذية في فترة ما قبل انقطاع الطمث تتعلق بالتغذية، ليس التقييد. جسدك يحتاج إلى بروتين أكثر من قبل - استهدفيه في كل وجبة. فكري في البيض، الزبادي اليوناني، السلمون، الدجاج، أو العدس. الدهون الصحية مهمة أيضًا: الأفوكادو، زيت الزيتون، الجوز، والفيجوا عندما يكون في الموسم. جربي الكومارا المشوية مع رشة زيت زيتون - إنه مريح وغني بالعناصر الغذائية. ومن فضلكِ، لا تتجنبي الكربوهيدرات تمامًا. دماغك يحتاجها. حبوب كاملة، ليس عقاب." });
    }
    if (lower.includes('exercise') || lower.includes('workout') || lower.includes('walk') || lower.includes('movement') || lower.includes('yoga')) {
        return getText({ en: "Movement is medicine, but gentle is the keyword now. High-intensity workouts can spike cortisol when your system is already stressed. Instead, try a coastal walk along your local beach, a gentle bush track, swimming in the ocean, or restorative yoga. Strength training twice a week protects your bones and metabolism as oestrogen declines. Most importantly: move in ways that feel good, not punitive.", ar: "الحركة دواء، لكن اللطف هو الكلمة المفتاحية الآن. التمارين عالية الكثافة يمكن أن ترفع الكورتيزول عندما يكون نظامك متوترًا بالفعل. بدلاً من ذلك، جربي نزهة على الساحل على طول شاطئك المحلي، مسار غابة لطيف، السباحة في المحيط، أو اليوغا الترميمية. تدريب القوة مرتين في الأسبوع يحمي عظامك وعملية الأيض مع انخفاض الإستروجين. الأهم من ذلك: تحركي بطرق تشعرين أنها جيدة، ليس عقابية." });
    }
    if (lower.includes('mood') || lower.includes('sad') || lower.includes('depress') || lower.includes('cry') || lower.includes('tear')) {
        return getText({ en: "The mood swings of perimenopause can feel like PMS multiplied by ten. One moment you are fine, the next you are sobbing over a television advert. This is not weakness. Oestrogen modulates serotonin, dopamine, and GABA — your brain\'s feel-good chemicals. When it fluctuates, so does your emotional stability. Be extra gentle with yourself. A daily walk, connection with a friend, and limiting alcohol can all help stabilise things. If low mood persists for more than two weeks, please speak to your GP or call 1737 in NZ / Lifeline in Australia.", ar: "تقلبات المزاج في فترة ما قبل انقطاع الطمث يمكن أن تشبه متلازمة ما قبل الحيض مضروبة في عشرة. لحظة كنتِ بخير، واللحظة التالية تبكين على إعلان تلفزيوني. هذا ليس ضعفًا. الإستروجين يعدل السيروتونين، الدوبامين، وGABA - المواد الكيميائية المسؤولة عن الشعور بالسعادة في دماغك. عندما يتقلب، يتقلب استقرارك العاطفي أيضًا. كوني لطيفة للغاية مع نفسك. المشي اليومي، التواصل مع صديق، والحد من الكحول كلها يمكن أن تساعد في تثبيت الأمور. إذا استمر المزاج المنخفض لأكثر من أسبوعين، من فضلكِ تحدثي مع طبيبك العام أو اتصلي بـ 1737 في نيوزيلندا / لايفلاين في أستراليا." });
    }
    if (lower.includes('alone') || lower.includes('lonely') || lower.includes('support') || lower.includes('friend') || lower.includes('partner') || lower.includes('husband')) {
        return getText({ en: "Feeling alone in this is one of the hardest parts. So many women suffer in silence because menopause is still treated like a taboo. But you are not alone. Thousands of women in New Zealand and Australia are walking this same path right now. The community here is full of kind, honest people who understand. And if your partner does not get it yet, that is okay. Sometimes they need education too. We even have a Partner Mode coming in a future update to help them understand what you are going through.", ar: "الشعور بالوحدة في هذا هو واحد من أصعب الأجزاء. العديد من النساء يعانين في صمت لأن انقطاع الطمث لا يزال يُعامل وكأنه محظور. لكنكِ لست وحدك. آلاف النساء في نيوزيلندا وأستراليا يسلكن هذا الطريق نفسه الآن. المجتمع هنا مليء بأشخاص لطفاء وصادقين يفهمون. وإذا لم يفهم شريكك بعد، فلا بأس. أحيانًا يحتاجون إلى التعليم أيضًا. لدينا حتى وضع الشريك قادم في تحديث مستقبلي لمساعدتهم على فهم ما تمرين به." });
    }
    if (lower.includes('perimenopause') || lower.includes('what is') || lower.includes('explain')) {
        return getText({ en: "Perimenopause is the transition phase before menopause. It usually starts in your 40s, sometimes earlier. Your ovaries gradually slow down oestrogen production, and your periods become irregular. Symptoms can include hot flashes, mood swings, brain fog, sleep issues, anxiety, and fatigue. It can last months or even ten years. Every woman\'s experience is different. You are not broken — your body is simply changing gears.", ar: "فترة ما قبل انقطاع الطمث هي مرحلة الانتقال قبل انقطاع الطمث. عادة ما تبدأ في الأربعينيات، وأحيانًا أ earlier. تبطئ مبيضاك تدريجيًا إنتاج الإستروجين، وتصبح دوراتك غير منتظمة. يمكن أن تشمل الأعراض الهبات الساخنة، تقلبات المزاج، ضباب الدماغ، مشاكل النوم، القلق، والإرهاق. يمكن أن تستمر شهورًا أو حتى عشر سنوات. تجربة كل امرأة مختلفة. أنتِ لست مكسورة - جسدك يغير التروس ببساطة." });
    }
    // Default warm response
    return getText({
        en: "Thank you for sharing that with me. I want you to know that whatever you are feeling right now is valid. Your body is going through one of the biggest hormonal shifts of your life, and that is not easy. Is there something specific I can help you with today — sleep, nutrition, mood, or just someone to listen?",
        ar: "شكرًا لمشاركتي ذلك. أريدك أن تعرفي أن كل ما تشعرين به الآن صالح. جسدك يمر بأحد أكبر التحولات الهرمونية في حياتك، وهذا ليس سهلًا. هل هناك شيء محدد يمكنني مساعدتك فيه اليوم - النوم، التغذية، المزاج، أو فقط شخص للاستماع؟"
    });
}

function showPremiumModal() {
    document.getElementById('premium-modal').classList.remove('hidden');
}
function closePremiumModal() {
    document.getElementById('premium-modal').classList.add('hidden');
}

function renderSettings() {
    document.getElementById('theme-toggle').checked = AppState.theme === 'dark';
    document.getElementById('current-lang').textContent = AppState.language === 'en' ? 'English' : 'العربية';
    document.getElementById('premium-status').textContent = AppState.isPremium ? (AppState.language === 'en' ? 'Active' : 'نشط') : getText({en: 'Free', ar: 'مجاني'});
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
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
