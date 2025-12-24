/**
 * Praxia-1 Main Application
 * Cadencia Protocol | Grey Stratum
 */

const Praxia = (function() {
  'use strict';

  // Application state
  const state = {
    initialized: false,
    activeView: null,
    praxisSession: {
      active: false,
      startTime: null,
      timer: null,
      secondsRemaining: 900,
      preMood: null,
      postMood: null,
      skills: { praise: 0, reflect: 0, imitate: 0, describe: 0, enjoy: 0 },
      currentSkillIndex: 0
    },
    respiro: { step: 0 },
    filiusRespiro: { step: 0 },
    gauge: { value: 5 },
    selectedWords: new Set(),
    selectedInterventions: new Set()
  };

  // Skill prompts
  const SKILL_PROMPTS = [
    { skill: 'praise', text: 'Labeled Praise', hint: '"I love how carefully you\'re building that!"' },
    { skill: 'praise', text: 'Effort Praise', hint: '"You\'re working so hard on that!"' },
    { skill: 'reflect', text: 'Word Reflection', hint: 'Child: "Look!" → "You want me to see!"' },
    { skill: 'reflect', text: 'Feeling Reflection', hint: '"You seem really excited about that!"' },
    { skill: 'describe', text: 'Action Description', hint: '"You\'re putting the blue block on top."' },
    { skill: 'describe', text: 'Choice Description', hint: '"You decided to use the red pieces."' }
  ];

  // Respiro steps
  const RESPIRO_STEPS = [
    { id: 'halt', title: 'Halt', instruction: 'Freeze. Do not react. Pause here.', childInstruction: 'Freeze like a statue!', class: 'step-halt' },
    { id: 'retreat', title: 'Retreat', instruction: 'Create space. Lower stimulation.', childInstruction: 'Hug yourself like a shell.', class: 'step-retreat' },
    { id: 'breathe', title: 'Breathe', instruction: 'Take 3 deep breaths. In through nose, out through mouth.', childInstruction: 'Smell the flower, blow out the candle.', class: 'step-breathe' },
    { id: 'reflect', title: 'Reflect', instruction: 'Ask: What am I feeling? What do I need?', childInstruction: 'How do I feel? What happened?', class: 'step-reflect' },
    { id: 'resolve', title: 'Resolve', instruction: 'Now you can think clearly. What\'s one small step?', childInstruction: 'What can I do now?', class: 'step-resolve' }
  ];

  // State vocabulary
  const STATE_WORDS = {
    low: ['calm', 'content', 'peaceful', 'relaxed', 'stable', 'neutral'],
    medium: ['uncertain', 'unsettled', 'agitated', 'uncomfortable', 'stressed', 'anxious'],
    high: ['frustrated', 'elevated', 'overwhelmed', 'intense', 'dysregulated', 'critical']
  };

  /**
   * Initialize the application
   */
  async function init() {
    console.log('[Praxia] Initializing...');
    
    // Load configurations
    await Promise.all([
      PraxiaCurriculum.loadCurriculum(),
      PraxiaRewards.loadRewards()
    ]);

    // Initialize or load user data
    initializeUserData();
    
    // Apply saved theme
    applyTheme(PraxiaStorage.get('settings')?.theme || 'dark');
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize UI components
    initGauges();
    startBreathingAnimation();
    
    // Navigate to home
    const user = PraxiaUsers.getActiveUser();
    navigateToHome(user?.role || 'custos');
    
    // Update dashboard
    updateDashboard();
    
    state.initialized = true;
    console.log('[Praxia] Initialized');
  }

  /**
   * Initialize user data if not exists
   */
  function initializeUserData() {
    const users = PraxiaUsers.getAllUsers();
    
    if (users.length === 0) {
      // Create default family and users
      PraxiaUsers.initializeFamily('Our Family');
      PraxiaUsers.createUser({ role: 'custos', name: 'Parent 1', displayLabel: 'Custos' });
      PraxiaUsers.createUser({ role: 'filius', name: 'Child', displayLabel: 'Filius' });
    }
  }

  /**
   * Set up global event listeners
   */
  function setupEventListeners() {
    // Theme toggle
    document.querySelector('.theme-toggle')?.addEventListener('click', toggleTheme);
    
    // User toggle buttons
    document.getElementById('toggle-custos')?.addEventListener('click', () => switchUser('custos'));
    document.getElementById('toggle-filius')?.addEventListener('click', () => switchUser('filius'));
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach((btn, i) => {
      btn.addEventListener('click', () => navigateTo(i === 0 ? 'home' : 'progressio'));
    });
  }

  // ========================================
  // THEME
  // ========================================

  function applyTheme(theme) {
    const t = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    const label = document.getElementById('themeLabel');
    if (label) label.textContent = t === 'dark' ? '[ NOX ]' : '[ LUX ]';
    
    const settings = PraxiaStorage.get('settings') || {};
    settings.theme = t;
    PraxiaStorage.set('settings', settings);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  // ========================================
  // NAVIGATION
  // ========================================

  function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById(viewId);
    if (el) {
      el.classList.add('active');
      state.activeView = viewId;
    }
    
    // Initialize view-specific components
    if (viewId === 'view-status-checkin') {
      renderStateVocabulary();
    } else if (viewId === 'view-respiro') {
      state.respiro.step = 0;
      renderRespiroStep('respiro', state.respiro.step);
    } else if (viewId === 'view-filius-respiro') {
      state.filiusRespiro.step = 0;
      renderRespiroStep('filius-respiro', state.filiusRespiro.step, true);
    } else if (viewId === 'view-progressio') {
      updateProgressio();
    }
  }

  function switchUser(role) {
    const users = PraxiaUsers.getUsersByRole(role);
    if (users.length > 0) {
      PraxiaUsers.setActiveUser(users[0].id);
    }
    
    // Update toggle buttons
    document.getElementById('toggle-custos')?.classList.toggle('active', role === 'custos');
    document.getElementById('toggle-filius')?.classList.toggle('active', role === 'filius');
    
    navigateToHome(role);
    updateDashboard();
  }

  function navigateToHome(role) {
    showView(role === 'filius' ? 'view-filius-home' : 'view-custos-home');
    setActiveNav('home');
  }

  function navigateTo(dest) {
    const user = PraxiaUsers.getActiveUser();
    const role = user?.role || 'custos';
    
    if (dest === 'home') {
      navigateToHome(role);
    } else if (dest === 'progressio') {
      showView('view-progressio');
      setActiveNav('progressio');
    }
  }

  function setActiveNav(key) {
    document.querySelectorAll('.bottom-nav .nav-item').forEach((btn, i) => {
      btn.classList.toggle('active', (key === 'home' && i === 0) || (key === 'progressio' && i === 1));
    });
  }

  // ========================================
  // DASHBOARD
  // ========================================

  function updateDashboard() {
    const user = PraxiaUsers.getActiveUser();
    if (!user) return;

    const sessions = PraxiaStorage.query('sessions', { userId: user.id });
    const streak = PraxiaRewards.calculateStreak(user.id);
    
    const totalSkills = sessions.reduce((sum, s) => {
      const skills = s.skills || {};
      return sum + Object.values(skills).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    }, 0);

    const streakEl = document.getElementById('stat-streak');
    const sessionsEl = document.getElementById('stat-sessions');
    const skillsEl = document.getElementById('stat-skills');

    if (streakEl) streakEl.textContent = String(streak);
    if (sessionsEl) sessionsEl.textContent = String(sessions.length);
    if (skillsEl) skillsEl.textContent = String(totalSkills);
  }

  // ========================================
  // PRAXIS SESSION
  // ========================================

  function selectPreMood(mood) {
    state.praxisSession.preMood = mood;
    selectMoodScale('pre-mood-scale', mood);
    const btn = document.getElementById('start-praxis-btn');
    if (btn) btn.disabled = false;
  }

  function selectPostMood(mood) {
    state.praxisSession.postMood = mood;
    selectMoodScale('post-mood-scale', mood);
    const btn = document.getElementById('save-session-btn');
    if (btn) btn.disabled = false;
  }

  function selectMoodScale(containerId, mood) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.mood-scale-btn').forEach(btn => {
      btn.classList.toggle('selected', parseInt(btn.dataset.mood) === mood);
    });
  }

  function startPraxis() {
    state.praxisSession.active = true;
    state.praxisSession.startTime = Date.now();
    state.praxisSession.secondsRemaining = 900;
    state.praxisSession.skills = { praise: 0, reflect: 0, imitate: 0, describe: 0, enjoy: 0 };
    state.praxisSession.currentSkillIndex = 0;

    showView('view-praxis-active');
    updateSkillPrompt();
    updateTimerDisplay();
    setTimerProgress(state.praxisSession.secondsRemaining, 900);

    state.praxisSession.timer = setInterval(() => {
      state.praxisSession.secondsRemaining--;
      updateTimerDisplay();
      setTimerProgress(state.praxisSession.secondsRemaining, 900);
      
      if (state.praxisSession.secondsRemaining <= 0) {
        completePraxis();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const sec = state.praxisSession.secondsRemaining;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const el = document.getElementById('timer-display');
    if (el) el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function setTimerProgress(remaining, total) {
    const circle = document.getElementById('timer-progress');
    if (!circle) return;
    const circumference = 565;
    const progress = remaining / total;
    circle.style.strokeDashoffset = String(circumference * (1 - progress));
  }

  function updateSkillPrompt() {
    const prompt = SKILL_PROMPTS[state.praxisSession.currentSkillIndex];
    const textEl = document.getElementById('skill-prompt-text');
    const hintEl = document.getElementById('skill-prompt-hint');
    const countEl = document.getElementById('skill-count');

    if (textEl) textEl.textContent = prompt.text;
    if (hintEl) hintEl.textContent = prompt.hint;
    if (countEl) countEl.textContent = String(state.praxisSession.skills[prompt.skill] || 0);
  }

  function incrementSkill() {
    const prompt = SKILL_PROMPTS[state.praxisSession.currentSkillIndex];
    state.praxisSession.skills[prompt.skill]++;
    const countEl = document.getElementById('skill-count');
    if (countEl) countEl.textContent = String(state.praxisSession.skills[prompt.skill]);
  }

  function decrementSkill() {
    const prompt = SKILL_PROMPTS[state.praxisSession.currentSkillIndex];
    if (state.praxisSession.skills[prompt.skill] > 0) {
      state.praxisSession.skills[prompt.skill]--;
      const countEl = document.getElementById('skill-count');
      if (countEl) countEl.textContent = String(state.praxisSession.skills[prompt.skill]);
    }
  }

  function nextSkillPrompt() {
    state.praxisSession.currentSkillIndex = (state.praxisSession.currentSkillIndex + 1) % SKILL_PROMPTS.length;
    updateSkillPrompt();
  }

  function endPraxisEarly() {
    if (confirm('Terminate session early?')) {
      completePraxis();
    }
  }

  function completePraxis() {
    clearInterval(state.praxisSession.timer);
    state.praxisSession.active = false;

    const duration = Math.max(1, Math.round((900 - state.praxisSession.secondsRemaining) / 60));
    
    document.getElementById('session-duration').textContent = String(duration);
    document.getElementById('final-praise').textContent = String(state.praxisSession.skills.praise);
    document.getElementById('final-reflect').textContent = String(state.praxisSession.skills.reflect);
    document.getElementById('final-describe').textContent = String(state.praxisSession.skills.describe);

    showView('view-praxis-complete');
  }

  function saveSession() {
    const user = PraxiaUsers.getActiveUser();
    if (!user) return;

    const session = {
      userId: user.id,
      date: new Date().toISOString(),
      durationMinutes: Math.max(1, Math.round((900 - state.praxisSession.secondsRemaining) / 60)),
      preMood: state.praxisSession.preMood,
      postMood: state.praxisSession.postMood,
      skills: { ...state.praxisSession.skills },
      notes: document.getElementById('session-notes')?.value || ''
    };

    PraxiaStorage.append('sessions', session);
    
    // Award points
    const points = PraxiaRewards.getPointsForAction('sessionComplete') +
      PraxiaRewards.getPointsForAction('skillUsed', 
        Object.values(session.skills).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0));
    PraxiaUsers.addPoints(user.id, points);
    
    // Update streak
    PraxiaRewards.updateStreak(user.id);
    
    // Check achievements
    PraxiaRewards.checkAchievements(user.id);

    // Reset UI
    resetPraxisUI();
    
    showModal('Confirmed', 'Praxis session recorded.');
    setTimeout(() => {
      hideModal();
      navigateToHome('custos');
      updateDashboard();
    }, 2000);
  }

  function resetPraxisUI() {
    state.praxisSession.preMood = null;
    state.praxisSession.postMood = null;
    document.getElementById('session-notes').value = '';
    document.querySelectorAll('#pre-mood-scale .mood-scale-btn, #post-mood-scale .mood-scale-btn')
      .forEach(btn => btn.classList.remove('selected'));
    document.getElementById('start-praxis-btn').disabled = true;
    document.getElementById('save-session-btn').disabled = true;
  }

  // ========================================
  // GAUGE
  // ========================================

  function initGauges() {
    initGauge('gauge-track', 'gauge-handle', v => { state.gauge.value = v; renderStateVocabulary(); });
    initGauge('episode-gauge-track', 'episode-gauge-handle', v => { state.gauge.value = v; });
  }

  function initGauge(trackId, handleId, onChange) {
    const track = document.getElementById(trackId);
    const handle = document.getElementById(handleId);
    if (!track || !handle) return;

    const update = (clientX) => {
      const rect = track.getBoundingClientRect();
      let pct = (clientX - rect.left) / rect.width;
      pct = Math.max(0, Math.min(1, pct));
      const val = Math.round(pct * 9) + 1;
      handle.style.left = `${pct * 100}%`;
      handle.textContent = String(val);
      if (onChange) onChange(val);
    };

    handle.addEventListener('pointerdown', e => {
      handle.setPointerCapture(e.pointerId);
      update(e.clientX);
    });
    track.addEventListener('pointermove', e => { if (e.buttons) update(e.clientX); });
    track.addEventListener('pointerdown', e => update(e.clientX));
  }

  // ========================================
  // STATE VOCABULARY
  // ========================================

  function renderStateVocabulary() {
    const container = document.getElementById('state-vocabulary');
    if (!container) return;

    let words;
    if (state.gauge.value <= 3) words = STATE_WORDS.low;
    else if (state.gauge.value <= 6) words = STATE_WORDS.medium;
    else words = STATE_WORDS.high;

    container.innerHTML = words.map(w => 
      `<span class="state-word ${state.selectedWords.has(w) ? 'selected' : ''}" data-word="${w}">${w}</span>`
    ).join('');

    container.querySelectorAll('.state-word').forEach(el => {
      el.addEventListener('click', () => {
        const word = el.dataset.word;
        if (state.selectedWords.has(word)) {
          state.selectedWords.delete(word);
          el.classList.remove('selected');
        } else {
          state.selectedWords.add(word);
          el.classList.add('selected');
        }
      });
    });
  }

  function saveStatusCheckin() {
    const user = PraxiaUsers.getActiveUser();
    if (!user) return;

    const checkin = {
      userId: user.id,
      intensity: state.gauge.value,
      words: Array.from(state.selectedWords),
      context: document.getElementById('status-context')?.value || ''
    };

    PraxiaStorage.append('statusCheckins', checkin);
    PraxiaUsers.addPoints(user.id, PraxiaRewards.getPointsForAction('dailyCheckin'));

    // Reset
    state.gauge.value = 5;
    state.selectedWords.clear();
    document.getElementById('status-context').value = '';
    const handle = document.getElementById('gauge-handle');
    if (handle) { handle.textContent = '5'; handle.style.left = '50%'; }

    showModal('Confirmed', 'Status check-in saved.');
    setTimeout(() => {
      hideModal();
      navigateToHome('custos');
    }, 1500);
  }

  // ========================================
  // RESPIRO
  // ========================================

  function renderRespiroStep(prefix, stepIndex, isChild = false) {
    const step = RESPIRO_STEPS[stepIndex];
    const dotsContainer = document.getElementById(`${prefix}-dots`);
    const visual = document.getElementById(`${prefix}-visual`);
    const title = document.getElementById(`${prefix}-title`);
    const instruction = document.getElementById(`${prefix}-instruction`);
    const prevBtn = document.getElementById(`${prefix}-prev`);
    const nextBtn = document.getElementById(`${prefix}-next`);

    if (dotsContainer) {
      [...dotsContainer.children].forEach((dot, i) => dot.classList.toggle('active', i === stepIndex));
    }
    if (visual) visual.className = `respiro-visual ${step.class}`;
    if (title) title.textContent = step.title;
    if (instruction) instruction.textContent = isChild ? step.childInstruction : step.instruction;
    if (prevBtn) prevBtn.disabled = stepIndex === 0;
    if (nextBtn) nextBtn.textContent = stepIndex === RESPIRO_STEPS.length - 1 ? '[ Done ]' : '[ Next ]';
  }

  function respiroNext() {
    if (state.respiro.step < RESPIRO_STEPS.length - 1) {
      state.respiro.step++;
      renderRespiroStep('respiro', state.respiro.step);
    } else {
      completeRespiro();
    }
  }

  function respiroPrev() {
    if (state.respiro.step > 0) {
      state.respiro.step--;
      renderRespiroStep('respiro', state.respiro.step);
    }
  }

  function filiusRespiroNext() {
    if (state.filiusRespiro.step < RESPIRO_STEPS.length - 1) {
      state.filiusRespiro.step++;
      renderRespiroStep('filius-respiro', state.filiusRespiro.step, true);
    } else {
      completeRespiro(true);
    }
  }

  function filiusRespiroPrev() {
    if (state.filiusRespiro.step > 0) {
      state.filiusRespiro.step--;
      renderRespiroStep('filius-respiro', state.filiusRespiro.step, true);
    }
  }

  function completeRespiro(isChild = false) {
    const user = PraxiaUsers.getActiveUser();
    if (user) {
      PraxiaStorage.append('respiroCompletions', {
        userId: user.id,
        guided: true,
        completedAt: new Date().toISOString()
      });
      PraxiaUsers.addPoints(user.id, PraxiaRewards.getPointsForAction('respiroComplete'));
      PraxiaRewards.checkAchievements(user.id);
    }

    showModal('Confirmed', isChild ? 'Great job calming down!' : 'Respiro protocol completed.');
    setTimeout(() => {
      hideModal();
      navigateToHome(isChild ? 'filius' : 'custos');
    }, 1500);
  }

  // ========================================
  // EPISODES
  // ========================================

  function toggleIntervention(el, intervention) {
    if (state.selectedInterventions.has(intervention)) {
      state.selectedInterventions.delete(intervention);
      el.classList.remove('selected');
    } else {
      state.selectedInterventions.add(intervention);
      el.classList.add('selected');
    }
  }

  function saveEpisode() {
    const user = PraxiaUsers.getActiveUser();
    if (!user) return;

    const episode = {
      userId: user.id,
      intensity: parseInt(document.getElementById('episode-gauge-handle')?.textContent || '5'),
      trigger: document.getElementById('episode-trigger')?.value || '',
      interventions: Array.from(state.selectedInterventions),
      durationMinutes: parseInt(document.getElementById('episode-duration')?.value) || null,
      notes: document.getElementById('episode-notes')?.value || ''
    };

    PraxiaStorage.append('episodes', episode);

    // Reset
    state.selectedInterventions.clear();
    document.getElementById('episode-trigger').value = '';
    document.getElementById('episode-duration').value = '';
    document.getElementById('episode-notes').value = '';
    document.querySelectorAll('#intervention-options .state-word').forEach(el => el.classList.remove('selected'));
    const handle = document.getElementById('episode-gauge-handle');
    if (handle) { handle.textContent = '5'; handle.style.left = '50%'; }

    showModal('Confirmed', 'Episode logged for pattern analysis.');
    setTimeout(() => {
      hideModal();
      navigateToHome('custos');
    }, 1500);
  }

  // ========================================
  // FILIUS
  // ========================================

  function selectFiliusMood(mood, btn) {
    const user = PraxiaUsers.getActiveUser();
    if (user) {
      PraxiaStorage.append('moodCheckins', {
        userId: user.id,
        mood
      });
      PraxiaUsers.addPoints(user.id, PraxiaRewards.getPointsForAction('dailyCheckin'));
    }

    document.querySelectorAll('#filius-mood-grid .mood-btn').forEach(b => b.classList.remove('selected'));
    btn?.classList.add('selected');

    showModal('Confirmed', 'Status recorded.');
    setTimeout(() => {
      hideModal();
      btn?.classList.remove('selected');
    }, 1500);
  }

  // ========================================
  // PROGRESSIO
  // ========================================

  function updateProgressio() {
    const user = PraxiaUsers.getActiveUser();
    if (!user) return;

    const sessions = PraxiaStorage.query('sessions', { userId: user.id });
    const episodes = PraxiaStorage.query('episodes', { userId: user.id });
    const streak = PraxiaRewards.calculateStreak(user.id);

    document.getElementById('progress-streak').textContent = String(streak);
    document.getElementById('progress-sessions').textContent = String(sessions.length);
    document.getElementById('progress-episodes').textContent = String(episodes.length);

    // Weekly skills
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weeklySessions = sessions.filter(s => new Date(s.date) >= oneWeekAgo);
    const weeklySkills = weeklySessions.reduce((acc, s) => {
      acc.praise += s.skills?.praise || 0;
      acc.reflect += s.skills?.reflect || 0;
      acc.describe += s.skills?.describe || 0;
      return acc;
    }, { praise: 0, reflect: 0, describe: 0 });

    document.getElementById('weekly-praise').textContent = String(weeklySkills.praise);
    document.getElementById('weekly-reflect').textContent = String(weeklySkills.reflect);
    document.getElementById('weekly-describe').textContent = String(weeklySkills.describe);

    // Calendar
    renderCalendar(sessions);
  }

  function renderCalendar(sessions) {
    const cal = document.getElementById('progressio-calendar');
    if (!cal) return;

    const today = new Date();
    const sessionDates = new Set(sessions.map(s => (s.date || s.createdAt).slice(0, 10)));
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d);
    }

    cal.innerHTML = days.map(d => {
      const ds = d.toISOString().slice(0, 10);
      const isToday = ds === today.toISOString().slice(0, 10);
      const completed = sessionDates.has(ds);
      return `<div class="calendar-day ${completed ? 'completed' : ''} ${isToday ? 'today' : ''}">${dayLabels[d.getDay()]}</div>`;
    }).join('');
  }

  // ========================================
  // MODAL
  // ========================================

  function showModal(title, message) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    document.getElementById('modal-confirm').classList.add('active');
  }

  function hideModal() {
    document.getElementById('modal-confirm').classList.remove('active');
  }

  // ========================================
  // BREATHING ANIMATION
  // ========================================

  function startBreathingAnimation() {
    const texts = ['Inhale', 'Hold', 'Exhale', 'Hold'];
    const durations = [4000, 1000, 4000, 1000];
    let i = 0;

    function update() {
      const els = [document.getElementById('breathing-text'), document.getElementById('filius-breathing-text')];
      els.forEach(el => { if (el) el.textContent = texts[i]; });
      setTimeout(() => { i = (i + 1) % texts.length; update(); }, durations[i]);
    }
    update();
  }

  // ========================================
  // PUBLIC API
  // ========================================

  return {
    init,
    showView,
    switchUser,
    navigateTo,
    toggleTheme,
    selectPreMood,
    selectPostMood,
    startPraxis,
    incrementSkill,
    decrementSkill,
    nextSkillPrompt,
    endPraxisEarly,
    saveSession,
    saveStatusCheckin,
    respiroNext,
    respiroPrev,
    filiusRespiroNext,
    filiusRespiroPrev,
    toggleIntervention,
    saveEpisode,
    selectFiliusMood,
    showModal,
    hideModal,
    updateDashboard
  };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => Praxia.init());

// Expose globally for HTML onclick handlers
window.showView = Praxia.showView;
window.switchUser = Praxia.switchUser;
window.navigateTo = Praxia.navigateTo;
window.toggleTheme = Praxia.toggleTheme;
window.selectPreMood = Praxia.selectPreMood;
window.selectPostMood = Praxia.selectPostMood;
window.startPraxis = Praxia.startPraxis;
window.incrementSkill = Praxia.incrementSkill;
window.decrementSkill = Praxia.decrementSkill;
window.nextSkillPrompt = Praxia.nextSkillPrompt;
window.endPraxisEarly = Praxia.endPraxisEarly;
window.saveSession = Praxia.saveSession;
window.saveStatusCheckin = Praxia.saveStatusCheckin;
window.respiroNext = Praxia.respiroNext;
window.respiroPrev = Praxia.respiroPrev;
window.filiusRespiroNext = Praxia.filiusRespiroNext;
window.filiusRespiroPrev = Praxia.filiusRespiroPrev;
window.toggleIntervention = Praxia.toggleIntervention;
window.saveEpisode = Praxia.saveEpisode;
window.selectFiliusMood = Praxia.selectFiliusMood;
window.hideModal = Praxia.hideModal;
