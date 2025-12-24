/**
 * Praxia-1 Main Application
 * Cadencia Protocol | Grey Stratum
 * 
 * Core orchestration layer - delegates to view modules
 */

const Praxia = (function() {
  'use strict';

  // ========================================
  // APPLICATION STATE
  // ========================================
  
  const state = {
    initialized: false,
    activeView: null,
    skillPrompts: [],
    respiroSteps: [],
    praxisSession: {
      active: false,
      startTime: null,
      targetEndTime: null,
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

  // DOM Cache for performance
  const domCache = {
    timerDisplay: null,
    timerProgress: null,
    skillCount: null,
    skillText: null,
    skillHint: null
  };

  // ========================================
  // INITIALIZATION
  // ========================================

  async function init() {
    console.log('[Praxia] Initializing...');
    
    try {
      // Load all configurations in parallel
      await Promise.all([
        PraxiaCurriculum.loadCurriculum(),
        PraxiaCurriculum.loadSkills(),
        PraxiaCurriculum.loadContent(),
        PraxiaRewards.loadRewards(),
        PraxiaUsers.loadRoles()
      ]);
      
      // Initialize skill prompts from loaded data
      state.skillPrompts = PraxiaCurriculum.getSkillPrompts();
      state.respiroSteps = PraxiaCurriculum.getRespiroSteps();
      
      // Fallback if skills.json didn't load
      if (state.skillPrompts.length === 0) {
        state.skillPrompts = [
          { skill: 'praise', text: 'Labeled Praise', hint: '"I love how carefully you\'re building that!"' },
          { skill: 'praise', text: 'Effort Praise', hint: '"You\'re working so hard on that!"' },
          { skill: 'reflect', text: 'Word Reflection', hint: 'Child: "Look!" → "You want me to see!"' },
          { skill: 'reflect', text: 'Feeling Reflection', hint: '"You seem really excited about that!"' },
          { skill: 'describe', text: 'Action Description', hint: '"You\'re putting the blue block on top."' },
          { skill: 'describe', text: 'Choice Description', hint: '"You decided to use the red pieces."' }
        ];
      }
      
      if (state.respiroSteps.length === 0) {
        state.respiroSteps = [
          { id: 'halt', name: 'Halt', instruction: 'Freeze. Do not react. Pause here.', childInstruction: 'Freeze like a statue!', visualState: 'step-halt' },
          { id: 'retreat', name: 'Retreat', instruction: 'Create space. Lower stimulation.', childInstruction: 'Hug yourself like a shell.', visualState: 'step-retreat' },
          { id: 'breathe', name: 'Breathe', instruction: 'Take 3 deep breaths. In through nose, out through mouth.', childInstruction: 'Smell the flower, blow out the candle.', visualState: 'step-breathe' },
          { id: 'reflect', name: 'Reflect', instruction: 'Ask: What am I feeling? What do I need?', childInstruction: 'How do I feel? What happened?', visualState: 'step-reflect' },
          { id: 'resolve', name: 'Resolve', instruction: 'Now you can think clearly. What\'s one small step?', childInstruction: 'What can I do now?', visualState: 'step-resolve' }
        ];
      }

      // Initialize or load user data
      initializeUserData();
      
      // Apply saved theme
      applyTheme(PraxiaStorage.get('settings')?.theme || 'dark');
      
      // Set up event listeners
      setupEventListeners();
      
      // Initialize UI components
      initGauges();
      startBreathingAnimation();
      
      // Check for active session persistence
      const savedSession = localStorage.getItem('praxia_active_session');
      if (savedSession) {
        try {
          const sessionData = JSON.parse(savedSession);
          if (sessionData && sessionData.targetEndTime > Date.now()) {
            resumePraxis(sessionData);
          } else {
            localStorage.removeItem('praxia_active_session');
            navigateToHomeDefault();
          }
        } catch (e) {
          console.error('Error resuming session', e);
          navigateToHomeDefault();
        }
      } else {
        // Check if onboarding needed
        const user = PraxiaUsers.getActiveUser();
        if (user && !PraxiaUsers.isOnboardingComplete(user.id)) {
          showView('view-onboarding');
        } else {
          navigateToHomeDefault();
        }
      }
      
      updateDashboard();
      
      state.initialized = true;
      console.log('[Praxia] Initialized');
      
    } catch (e) {
      console.error('[Praxia] Initialization error:', e);
      navigateToHomeDefault();
    }
  }

  function initializeUserData() {
    const users = PraxiaUsers.getAllUsers();
    
    if (users.length === 0) {
      PraxiaUsers.initializeFamily('Our Family');
      PraxiaUsers.createUser({ role: 'custos', name: 'Parent', displayLabel: 'Custos' });
      PraxiaUsers.createUser({ role: 'filius', name: 'Child', displayLabel: 'Filius' });
    }
  }

  function setupEventListeners() {
    // Theme toggle
    document.querySelector('.theme-toggle')?.addEventListener('click', toggleTheme);
    
    // User toggle buttons
    document.getElementById('toggle-custos')?.addEventListener('click', () => switchUser('custos'));
    document.getElementById('toggle-filius')?.addEventListener('click', () => switchUser('filius'));
    
    // Navigation - event delegation
    document.getElementById('bottom-nav')?.addEventListener('click', (e) => {
      const navItem = e.target.closest('.nav-item');
      if (navItem) {
        navigateTo(navItem.dataset.nav);
      }
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
    switch (viewId) {
      case 'view-status-checkin':
        renderStateVocabulary();
        break;
      case 'view-respiro':
        state.respiro.step = 0;
        renderRespiroStep('respiro', state.respiro.step);
        break;
      case 'view-filius-respiro':
        state.filiusRespiro.step = 0;
        renderRespiroStep('filius-respiro', state.filiusRespiro.step, true);
        break;
      case 'view-progressio':
      case 'view-consilium':
        updateProgressio();
        break;
      case 'view-curriculum':
      case 'view-schola':
        renderCurriculum();
        break;
      case 'view-achievements':
      case 'view-filius-achievements':
        renderAchievements();
        break;
      case 'view-settings':
        renderSettings();
        break;
      case 'view-bibliotheca':
        renderBibliotheca();
        break;
      case 'view-ludus':
        renderLudus();
        break;
      case 'view-onboarding':
        renderOnboarding();
        break;
    }
  }

  function switchUser(role) {
    const users = PraxiaUsers.getUsersByRole(role);
    if (users.length > 0) {
      PraxiaUsers.setActiveUser(users[0].id);
    }
    
    document.getElementById('toggle-custos')?.classList.toggle('active', role === 'custos');
    document.getElementById('toggle-filius')?.classList.toggle('active', role === 'filius');
    
    navigateToHome(role);
    updateDashboard();
  }

  function navigateToHome(role) {
    showView(role === 'filius' ? 'view-filius-home' : 'view-custos-home');
    setActiveNav('home');
    updateNavForRole(role);
  }

  function navigateToHomeDefault() {
    const user = PraxiaUsers.getActiveUser();
    navigateToHome(user?.role || 'custos');
  }

  function navigateTo(dest) {
    const user = PraxiaUsers.getActiveUser();
    const role = user?.role || 'custos';
    
    switch (dest) {
      case 'home':
        navigateToHome(role);
        break;
      case 'progressio':
        showView(role === 'filius' ? 'view-filius-achievements' : 'view-consilium');
        setActiveNav('progressio');
        break;
      case 'consilium':
        showView('view-consilium');
        setActiveNav('progressio');
        break;
      case 'curriculum':
      case 'schola':
        showView('view-schola');
        setActiveNav('curriculum');
        break;
      case 'ludus':
        showView('view-ludus');
        setActiveNav('ludus');
        break;
      case 'bibliotheca':
        showView(role === 'filius' ? 'view-bibliotheca-filius' : 'view-bibliotheca');
        setActiveNav('bibliotheca');
        break;
      case 'settings':
        showView('view-settings');
        setActiveNav('settings');
        break;
    }
    
    updateNavForRole(role);
  }

  function setActiveNav(key) {
    document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.nav === key);
    });
  }

  function updateNavForRole(role) {
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;
    
    // Get nav items
    const items = nav.querySelectorAll('.nav-item');
    
    items.forEach(item => {
      const navId = item.dataset.nav;
      const labelEl = item.querySelector('span');
      
      if (role === 'filius') {
        // Child navigation
        switch (navId) {
          case 'curriculum':
          case 'schola':
            item.style.display = 'none';
            break;
          case 'settings':
            item.style.display = 'none';
            break;
          case 'progressio':
            item.style.display = '';
            if (labelEl) labelEl.textContent = 'Badges';
            break;
          case 'ludus':
            item.style.display = '';
            break;
          case 'bibliotheca':
            item.style.display = '';
            if (labelEl) labelEl.textContent = 'Library';
            break;
          default:
            item.style.display = '';
        }
      } else {
        // Parent navigation
        switch (navId) {
          case 'ludus':
            item.style.display = 'none';
            break;
          case 'progressio':
            item.style.display = '';
            if (labelEl) labelEl.textContent = 'Consilium';
            break;
          case 'curriculum':
          case 'schola':
            item.style.display = '';
            if (labelEl) labelEl.textContent = 'Schola';
            break;
          case 'bibliotheca':
            item.style.display = '';
            if (labelEl) labelEl.textContent = 'Bibliotheca';
            break;
          default:
            item.style.display = '';
        }
      }
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

    updateElement('stat-streak', String(streak));
    updateElement('stat-sessions', String(sessions.length));
    updateElement('stat-skills', String(totalSkills));
    
    // Update Filius dashboard
    updateElement('filius-stat-streak', String(streak));
    const points = PraxiaRewards.getUserPoints(user.id);
    updateElement('filius-stat-points', String(points));
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
    const settings = PraxiaStorage.get('settings') || {};
    const durationSeconds = settings.praxisDuration || 900;
    
    state.praxisSession.active = true;
    state.praxisSession.startTime = Date.now();
    state.praxisSession.targetEndTime = Date.now() + (durationSeconds * 1000);
    state.praxisSession.secondsRemaining = durationSeconds;
    state.praxisSession.skills = { praise: 0, reflect: 0, imitate: 0, describe: 0, enjoy: 0 };
    state.praxisSession.currentSkillIndex = 0;

    cacheTimerDOM();
    showView('view-praxis-active');
    updateSkillPrompt();
    updateTimerDisplay();
    setTimerProgress(durationSeconds, durationSeconds);
    startTimerLoop();
    saveActiveSessionState();
  }

  function resumePraxis(savedSession) {
    state.praxisSession = savedSession;
    state.praxisSession.active = true;
    
    cacheTimerDOM();
    showView('view-praxis-active');
    updateSkillPrompt();
    startTimerLoop();
  }

  function cacheTimerDOM() {
    domCache.timerDisplay = document.getElementById('timer-display');
    domCache.timerProgress = document.getElementById('timer-progress');
    domCache.skillCount = document.getElementById('skill-count');
    domCache.skillText = document.getElementById('skill-prompt-text');
    domCache.skillHint = document.getElementById('skill-prompt-hint');
  }

  function startTimerLoop() {
    if (state.praxisSession.timer) clearInterval(state.praxisSession.timer);
    
    const settings = PraxiaStorage.get('settings') || {};
    const totalDuration = settings.praxisDuration || 900;
    
    state.praxisSession.timer = setInterval(() => {
      const now = Date.now();
      const remaining = Math.ceil((state.praxisSession.targetEndTime - now) / 1000);
      
      state.praxisSession.secondsRemaining = remaining;
      updateTimerDisplay();
      setTimerProgress(remaining, totalDuration);
      
      if (remaining <= 0) {
        completePraxis();
      }
    }, 1000);
  }

  function saveActiveSessionState() {
    if (!state.praxisSession.active) return;
    localStorage.setItem('praxia_active_session', JSON.stringify(state.praxisSession));
  }

  function updateTimerDisplay() {
    const sec = Math.max(0, state.praxisSession.secondsRemaining);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    
    if (domCache.timerDisplay) {
      domCache.timerDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
  }

  function setTimerProgress(remaining, total) {
    if (!domCache.timerProgress) return;
    const circumference = 565;
    const progress = Math.max(0, remaining) / total;
    domCache.timerProgress.style.strokeDashoffset = String(circumference * (1 - progress));
  }

  function updateSkillPrompt() {
    if (state.skillPrompts.length === 0) return;
    const prompt = state.skillPrompts[state.praxisSession.currentSkillIndex];
    if (domCache.skillText) domCache.skillText.textContent = prompt.text;
    if (domCache.skillHint) domCache.skillHint.textContent = prompt.hint;
    if (domCache.skillCount) domCache.skillCount.textContent = String(state.praxisSession.skills[prompt.skill] || 0);
  }

  function incrementSkill() {
    const prompt = state.skillPrompts[state.praxisSession.currentSkillIndex];
    state.praxisSession.skills[prompt.skill]++;
    if (domCache.skillCount) domCache.skillCount.textContent = String(state.praxisSession.skills[prompt.skill]);
    saveActiveSessionState();
  }

  function decrementSkill() {
    const prompt = state.skillPrompts[state.praxisSession.currentSkillIndex];
    if (state.praxisSession.skills[prompt.skill] > 0) {
      state.praxisSession.skills[prompt.skill]--;
      if (domCache.skillCount) domCache.skillCount.textContent = String(state.praxisSession.skills[prompt.skill]);
      saveActiveSessionState();
    }
  }

  function nextSkillPrompt() {
    state.praxisSession.currentSkillIndex = (state.praxisSession.currentSkillIndex + 1) % state.skillPrompts.length;
    updateSkillPrompt();
    saveActiveSessionState();
  }

  function endPraxisEarly() {
    if (confirm('Terminate session early?')) {
      completePraxis();
    }
  }

  function completePraxis() {
    clearInterval(state.praxisSession.timer);
    state.praxisSession.active = false;
    localStorage.removeItem('praxia_active_session');

    const settings = PraxiaStorage.get('settings') || {};
    const totalDuration = settings.praxisDuration || 900;
    const duration = Math.max(1, Math.round((totalDuration - state.praxisSession.secondsRemaining) / 60));
    
    updateElement('session-duration', String(duration));
    updateElement('final-praise', String(state.praxisSession.skills.praise));
    updateElement('final-reflect', String(state.praxisSession.skills.reflect));
    updateElement('final-describe', String(state.praxisSession.skills.describe));

    showView('view-praxis-complete');
  }

  function saveSession() {
    const user = PraxiaUsers.getActiveUser();
    if (!user) return;

    const settings = PraxiaStorage.get('settings') || {};
    const totalDuration = settings.praxisDuration || 900;
    
    const session = {
      userId: user.id,
      date: new Date().toISOString(),
      durationMinutes: Math.max(1, Math.round((totalDuration - state.praxisSession.secondsRemaining) / 60)),
      preMood: state.praxisSession.preMood,
      postMood: state.praxisSession.postMood,
      skills: { ...state.praxisSession.skills },
      notes: document.getElementById('session-notes')?.value || ''
    };

    PraxiaStorage.append('sessions', session);
    
    // Award points
    const skillCount = Object.values(session.skills).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    const points = PraxiaRewards.getPointsForAction('sessionComplete') +
      PraxiaRewards.getPointsForAction('skillUsed', skillCount);
    PraxiaUsers.addPoints(user.id, points);
    
    // Update streak
    PraxiaRewards.updateStreak(user.id);
    
    // Check achievements
    const newAchievements = PraxiaRewards.checkAchievements(user.id);

    resetPraxisUI();
    
    if (newAchievements.length > 0) {
      showModal('Achievement Unlocked!', `You earned: ${newAchievements.map(a => a.name).join(', ')}`);
    } else {
      showModal('Confirmed', 'Praxis session recorded.');
    }
    
    setTimeout(() => {
      hideModal();
      navigateToHome('custos');
      updateDashboard();
    }, 2000);
  }

  function resetPraxisUI() {
    state.praxisSession.preMood = null;
    state.praxisSession.postMood = null;
    const notes = document.getElementById('session-notes');
    if (notes) notes.value = '';
    document.querySelectorAll('#pre-mood-scale .mood-scale-btn, #post-mood-scale .mood-scale-btn')
      .forEach(btn => btn.classList.remove('selected'));
    const startBtn = document.getElementById('start-praxis-btn');
    const saveBtn = document.getElementById('save-session-btn');
    if (startBtn) startBtn.disabled = true;
    if (saveBtn) saveBtn.disabled = true;
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

    const emotionVocab = PraxiaCurriculum.getEmotionVocabulary();
    let words = [];
    
    if (emotionVocab?.intensity) {
      const val = state.gauge.value;
      if (val <= 2) words = emotionVocab.intensity['1-2']?.words || [];
      else if (val <= 4) words = emotionVocab.intensity['3-4']?.words || [];
      else if (val <= 6) words = emotionVocab.intensity['5-6']?.words || [];
      else if (val <= 8) words = emotionVocab.intensity['7-8']?.words || [];
      else words = emotionVocab.intensity['9-10']?.words || [];
    }
    
    // Fallback
    if (words.length === 0) {
      if (state.gauge.value <= 3) words = ['calm', 'content', 'peaceful', 'relaxed', 'stable', 'neutral'];
      else if (state.gauge.value <= 6) words = ['uncertain', 'unsettled', 'agitated', 'uncomfortable', 'stressed', 'anxious'];
      else words = ['frustrated', 'elevated', 'overwhelmed', 'intense', 'dysregulated', 'critical'];
    }

    container.innerHTML = words.map(w => 
      `<span class="state-word ${state.selectedWords.has(w) ? 'selected' : ''}" data-word="${w}">${w}</span>`
    ).join('');

    // Event delegation
    container.onclick = (e) => {
      const wordEl = e.target.closest('.state-word');
      if (!wordEl) return;
      const word = wordEl.dataset.word;
      if (state.selectedWords.has(word)) {
        state.selectedWords.delete(word);
        wordEl.classList.remove('selected');
      } else {
        state.selectedWords.add(word);
        wordEl.classList.add('selected');
      }
    };
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

    state.gauge.value = 5;
    state.selectedWords.clear();
    const contextEl = document.getElementById('status-context');
    if (contextEl) contextEl.value = '';
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
    const step = state.respiroSteps[stepIndex];
    if (!step) return;
    
    const dotsContainer = document.getElementById(`${prefix}-dots`);
    const visual = document.getElementById(`${prefix}-visual`);
    const title = document.getElementById(`${prefix}-title`);
    const instruction = document.getElementById(`${prefix}-instruction`);
    const prevBtn = document.getElementById(`${prefix}-prev`);
    const nextBtn = document.getElementById(`${prefix}-next`);

    if (dotsContainer) {
      [...dotsContainer.children].forEach((dot, i) => dot.classList.toggle('active', i === stepIndex));
    }
    if (visual) visual.className = `respiro-visual ${step.visualState || step.class || ''}`;
    if (title) title.textContent = step.name || step.title;
    if (instruction) instruction.textContent = isChild ? step.childInstruction : step.instruction;
    if (prevBtn) prevBtn.disabled = stepIndex === 0;
    if (nextBtn) nextBtn.textContent = stepIndex === state.respiroSteps.length - 1 ? '[ Done ]' : '[ Next ]';
  }

  function respiroNext() {
    if (state.respiro.step < state.respiroSteps.length - 1) {
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
    if (state.filiusRespiro.step < state.respiroSteps.length - 1) {
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

    state.selectedInterventions.clear();
    const triggerEl = document.getElementById('episode-trigger');
    const durationEl = document.getElementById('episode-duration');
    const notesEl = document.getElementById('episode-notes');
    if (triggerEl) triggerEl.value = '';
    if (durationEl) durationEl.value = '';
    if (notesEl) notesEl.value = '';
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
        mood,
        createdAt: new Date().toISOString()
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
  // HELPER FUNCTIONS
  // ========================================

  function updateElement(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function showModal(title, message) {
    updateElement('modal-title', title);
    updateElement('modal-message', message);
    document.getElementById('modal-confirm')?.classList.add('active');
  }

  function hideModal() {
    document.getElementById('modal-confirm')?.classList.remove('active');
  }

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
  // PROGRESSIO / CONSILIUM
  // ========================================

  function updateProgressio() {
    const user = PraxiaUsers.getActiveUser();
    if (!user) return;

    const sessions = PraxiaStorage.query('sessions', { userId: user.id });
    const episodes = PraxiaStorage.query('episodes', { userId: user.id });
    const streak = PraxiaRewards.calculateStreak(user.id);
    const familyStreak = PraxiaRewards.calculateFamilyStreak();
    const points = PraxiaRewards.getUserPoints(user.id);

    updateElement('progress-streak', String(streak));
    updateElement('progress-sessions', String(sessions.length));
    updateElement('progress-episodes', String(episodes.length));
    updateElement('consilium-streak', String(familyStreak));
    updateElement('consilium-points', String(points));

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

    updateElement('weekly-praise', String(weeklySkills.praise));
    updateElement('weekly-reflect', String(weeklySkills.reflect));
    updateElement('weekly-describe', String(weeklySkills.describe));

    renderCalendar(sessions);
    renderAssignmentsOverview();
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

  function renderAssignmentsOverview() {
    const container = document.getElementById('assignments-overview');
    if (!container) return;

    const user = PraxiaUsers.getActiveUser();
    if (!user) return;

    const assignments = PraxiaCurriculum.getCreatedAssignments(user.id);
    const active = assignments.filter(a => !a.completed);

    if (active.length === 0) {
      container.innerHTML = '<div class="empty-state">No active assignments</div>';
      return;
    }

    container.innerHTML = active.map(a => `
      <div class="assignment-card ${a.completed ? 'completed' : ''}">
        <div class="assignment-info">
          <div class="assignment-title">${a.title || 'Assignment'}</div>
          <div class="assignment-progress">${a.currentCount} / ${a.targetCount}</div>
        </div>
        <div class="assignment-status">${a.completed ? 'Complete' : 'In Progress'}</div>
      </div>
    `).join('');
  }

  // ========================================
  // CURRICULUM / SCHOLA
  // ========================================

  let currentPhase = 'fundamentum';
  let currentLessonId = null;

  function renderCurriculum() {
    const curriculum = PraxiaCurriculum.getCurriculum();
    if (!curriculum) return;

    const progress = PraxiaCurriculum.getGlobalProgress();
    const phase = PraxiaCurriculum.getPhaseForWeek(progress.currentWeek) || curriculum.phases[0];
    currentPhase = phase.id;
    
    updateElement('curriculum-phase-name', phase.name);
    updateElement('curriculum-phase-subtitle', phase.subtitle);
    updateElement('curriculum-phase-desc', phase.description);
    updateElement('curriculum-week', `Week ${progress.currentWeek}`);
    
    const phaseProgress = PraxiaCurriculum.calculatePhaseProgress(phase.id);
    const progressFill = document.getElementById('curriculum-progress-fill');
    if (progressFill) progressFill.style.width = `${phaseProgress}%`;
    
    renderWeekLessons(phase, progress.currentWeek, progress.completedLessons);
    updatePhaseNav(currentPhase);
  }

  function renderWeekLessons(phase, week, completedLessons) {
    const container = document.getElementById('curriculum-lessons-container');
    if (!container) return;
    
    const lessons = phase.lessons.filter(l => l.week === week);
    
    if (lessons.length === 0) {
      container.innerHTML = '<div class="empty-state">No lessons this week</div>';
      return;
    }
    
    container.innerHTML = lessons.map(lesson => {
      const isComplete = completedLessons.includes(lesson.id);
      return `
        <div class="lesson-card ${isComplete ? 'completed' : ''}" onclick="openLesson('${lesson.id}')">
          <div class="lesson-status ${isComplete ? 'completed' : ''}">
            <div class="gradus-mini">
              <div class="gradus-bar"></div>
              <div class="gradus-bar"></div>
              <div class="gradus-bar"></div>
            </div>
          </div>
          <div class="lesson-info">
            <div class="lesson-title">${lesson.title}</div>
            <div class="lesson-subtitle">${lesson.subtitle}</div>
          </div>
          <div class="lesson-meta">${lesson.duration} min</div>
        </div>
      `;
    }).join('');
  }

  function updatePhaseNav(activePhase) {
    document.querySelectorAll('.phase-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.phase === activePhase);
    });
  }

  function selectPhase(phaseId) {
    currentPhase = phaseId;
    const phase = PraxiaCurriculum.getPhase(phaseId);
    if (!phase) return;
    
    const progress = PraxiaCurriculum.getGlobalProgress();
    const weekToShow = phase.weeks[0];
    
    updateElement('curriculum-phase-name', phase.name);
    updateElement('curriculum-phase-subtitle', phase.subtitle);
    updateElement('curriculum-phase-desc', phase.description);
    updateElement('curriculum-week', `Week ${weekToShow}`);
    
    renderWeekLessons(phase, weekToShow, progress.completedLessons);
    updatePhaseNav(phaseId);
  }

  function openLesson(lessonId) {
    currentLessonId = lessonId;
    const lesson = PraxiaCurriculum.getLesson(lessonId);
    if (!lesson) return;
    
    const isComplete = PraxiaCurriculum.isLessonComplete(lessonId);
    
    updateElement('lesson-detail-title', lesson.title);
    updateElement('lesson-detail-subtitle', lesson.subtitle);
    updateElement('lesson-type-badge', lesson.type);
    updateElement('lesson-detail-description', lesson.description);
    
    const objectivesList = document.getElementById('lesson-objectives-list');
    if (objectivesList && lesson.objectives) {
      objectivesList.innerHTML = lesson.objectives.map(o => `<li>${o}</li>`).join('');
    }
    
    const briefingCard = document.getElementById('lesson-briefing-card');
    if (lesson.custosContent?.briefing) {
      updateElement('lesson-briefing-text', lesson.custosContent.briefing);
      if (briefingCard) briefingCard.style.display = '';
    } else if (briefingCard) briefingCard.style.display = 'none';
    
    const keyPointsCard = document.getElementById('lesson-key-points-card');
    const keyPointsList = document.getElementById('lesson-key-points-list');
    if (lesson.custosContent?.keyPoints && keyPointsList) {
      keyPointsList.innerHTML = lesson.custosContent.keyPoints.map(p => `<li>${p}</li>`).join('');
      if (keyPointsCard) keyPointsCard.style.display = '';
    } else if (keyPointsCard) keyPointsCard.style.display = 'none';
    
    const assignmentCard = document.getElementById('lesson-assignment-card');
    if (lesson.assignment) {
      updateElement('lesson-assignment-text', lesson.assignment.description);
      updateElement('lesson-assignment-count', `0 / ${lesson.assignment.targetCount}`);
      const statusEl = document.getElementById('lesson-assignment-status');
      if (statusEl) {
        statusEl.textContent = isComplete ? 'Complete' : 'Incomplete';
        statusEl.className = `assignment-status ${isComplete ? 'complete' : 'incomplete'}`;
      }
      if (assignmentCard) assignmentCard.style.display = '';
    } else if (assignmentCard) assignmentCard.style.display = 'none';
    
    const btn = document.getElementById('lesson-complete-btn');
    if (btn) btn.textContent = isComplete ? '[ Mark Incomplete ]' : '[ Mark Complete ]';
    
    showView('view-lesson-detail');
  }

  function toggleLessonComplete() {
    if (!currentLessonId) return;
    const user = PraxiaUsers.getActiveUser();
    const isComplete = PraxiaCurriculum.isLessonComplete(currentLessonId);
    
    if (isComplete) {
      PraxiaCurriculum.uncompleteLesson(currentLessonId);
      showModal('Confirmed', 'Lesson marked incomplete.');
    } else {
      PraxiaCurriculum.completeLesson(user?.id, currentLessonId);
      showModal('Confirmed', 'Lesson completed!');
    }
    
    setTimeout(() => {
      hideModal();
      showView('view-schola');
    }, 1500);
  }

  // ========================================
  // ACHIEVEMENTS
  // ========================================

  function renderAchievements() {
    const user = PraxiaUsers.getActiveUser();
    if (!user) return;
    
    const isFilius = user.role === 'filius';
    const rewards = PraxiaRewards.getRewards();
    const userAchievements = PraxiaStorage.get(`achievements_${user.id}`) || [];
    const points = PraxiaRewards.getUserPoints(user.id);
    const streak = PraxiaRewards.calculateStreak(user.id);
    
    const streakEl = isFilius ? document.getElementById('filius-streak') : document.getElementById('achievement-streak');
    if (streakEl) streakEl.textContent = String(streak);
    
    const pointsEl = isFilius ? document.getElementById('filius-points') : document.getElementById('total-points');
    if (pointsEl) pointsEl.textContent = String(points);
    
    if (!isFilius) {
      renderStreakMilestones(streak, rewards?.streakSystem?.milestones || []);
      const roleAchievements = rewards?.achievements?.custos || [];
      renderAchievementCards(roleAchievements, userAchievements);
      renderRewardsList(rewards?.unlockableRewards || [], points);
    } else {
      const roleAchievements = rewards?.achievements?.filius || [];
      renderFiliusAchievements(roleAchievements, userAchievements);
    }
  }

  function renderStreakMilestones(currentStreak, milestones) {
    const container = document.getElementById('streak-milestones');
    const nextEl = document.getElementById('streak-next-milestone');
    if (!container) return;
    
    let nextMilestone = null;
    container.innerHTML = milestones.slice(0, 5).map(m => {
      const achieved = currentStreak >= m.days;
      if (!achieved && !nextMilestone) nextMilestone = m;
      const progress = achieved ? 100 : Math.min(100, (currentStreak / m.days) * 100);
      return `<div class="streak-milestone ${achieved ? 'achieved' : 'current'}" style="--progress: ${progress}%" title="${m.name}: ${m.days} days"></div>`;
    }).join('');
    
    if (nextEl) {
      nextEl.textContent = nextMilestone ? `Next: ${nextMilestone.name} at ${nextMilestone.days} days` : 'All milestones achieved!';
    }
  }

  function renderAchievementCards(allAchievements, earnedIds) {
    const earnedContainer = document.getElementById('achievements-earned');
    const availableContainer = document.getElementById('achievements-available');
    
    const earned = allAchievements.filter(a => earnedIds.includes(a.id));
    const available = allAchievements.filter(a => !earnedIds.includes(a.id) && !a.hidden);
    
    if (earnedContainer) {
      earnedContainer.innerHTML = earned.length > 0 ? earned.map(a => `
        <div class="achievement-card earned">
          <div class="achievement-icon"><div class="gradus-mini"><div class="gradus-bar"></div><div class="gradus-bar"></div><div class="gradus-bar"></div></div></div>
          <div class="achievement-name">${a.name}</div>
          <div class="achievement-desc">${a.description}</div>
          <div class="achievement-points">+${a.points} pts</div>
        </div>
      `).join('') : '<div class="empty-state">Complete activities to earn achievements</div>';
    }
    
    if (availableContainer) {
      availableContainer.innerHTML = available.map(a => `
        <div class="achievement-card">
          <div class="achievement-icon"><div class="gradus-mini"><div class="gradus-bar"></div><div class="gradus-bar"></div><div class="gradus-bar"></div></div></div>
          <div class="achievement-name">${a.name}</div>
          <div class="achievement-desc">${a.description}</div>
          <div class="achievement-points">${a.points} pts</div>
        </div>
      `).join('');
    }
  }

  function renderRewardsList(rewards, currentPoints) {
    const container = document.getElementById('rewards-list');
    if (!container) return;
    
    if (!rewards || rewards.length === 0) {
      container.innerHTML = '<div class="empty-state">Rewards coming soon</div>';
      return;
    }
    
    container.innerHTML = rewards.map(r => {
      const unlocked = currentPoints >= (r.cost || 0);
      return `
        <div class="reward-card ${unlocked ? 'unlocked' : 'locked'}">
          <div class="reward-icon"><div class="gradus-mini"><div class="gradus-bar"></div><div class="gradus-bar"></div><div class="gradus-bar"></div></div></div>
          <div class="reward-info">
            <div class="reward-name">${r.name}</div>
            <div class="reward-desc">${r.description}</div>
          </div>
          <div class="reward-cost">${r.cost || 0} pts</div>
        </div>
      `;
    }).join('');
  }

  function renderFiliusAchievements(allAchievements, earnedIds) {
    const container = document.getElementById('filius-achievements-grid');
    if (!container) return;
    
    const earned = allAchievements.filter(a => earnedIds.includes(a.id));
    container.innerHTML = earned.length > 0 ? earned.map(a => `
      <div class="achievement-card earned">
        <div class="achievement-icon"><div class="gradus-mini"><div class="gradus-bar"></div><div class="gradus-bar"></div><div class="gradus-bar"></div></div></div>
        <div class="achievement-name">${a.name}</div>
        <div class="achievement-desc">${a.description}</div>
      </div>
    `).join('') : '<div class="empty-state">Keep practicing to earn badges!</div>';
  }

  // ========================================
  // BIBLIOTHECA (Library)
  // ========================================

  function renderBibliotheca() {
    const container = document.getElementById('bibliotheca-content');
    if (!container) return;

    const content = PraxiaCurriculum.getContent();
    const skills = PraxiaCurriculum.getSkills();
    
    if (!content && !skills) {
      container.innerHTML = '<div class="empty-state">Content loading...</div>';
      return;
    }

    // Render PRIDE skills reference
    const prideSkills = skills?.prideSkills || {};
    const research = content?.research || {};
    
    let html = '<div class="section-label">PRIDE Skills</div>';
    
    for (const [id, skill] of Object.entries(prideSkills)) {
      html += `
        <div class="card bibliotheca-card" onclick="showSkillDetail('${id}')">
          <div class="card-header">
            <div class="gradus-mini">
              <div class="gradus-bar"></div>
              <div class="gradus-bar"></div>
              <div class="gradus-bar"></div>
            </div>
            <div class="card-title">${skill.name}</div>
          </div>
          <div class="card-subtitle">${skill.shortDescription}</div>
        </div>
      `;
    }
    
    html += '<div class="section-label mt-lg">Research</div>';
    
    for (const [id, item] of Object.entries(research)) {
      html += `
        <div class="card bibliotheca-card" onclick="showResearchDetail('${id}')">
          <div class="card-title">${item.name}</div>
          <div class="card-subtitle">${item.description?.substring(0, 100)}...</div>
        </div>
      `;
    }
    
    container.innerHTML = html;
  }

  function showSkillDetail(skillId) {
    const skills = PraxiaCurriculum.getSkills();
    const skill = skills?.prideSkills?.[skillId];
    if (!skill) return;
    
    updateElement('detail-title', skill.name);
    updateElement('detail-latin', skill.latinName);
    updateElement('detail-description', skill.fullDescription);
    
    const examplesContainer = document.getElementById('detail-examples');
    if (examplesContainer && skill.examples?.good) {
      examplesContainer.innerHTML = `
        <div class="section-label">Good Examples</div>
        <ul class="examples-list">${skill.examples.good.map(e => `<li>${e}</li>`).join('')}</ul>
        ${skill.examples.avoid ? `
          <div class="section-label mt-md">Avoid</div>
          <ul class="examples-list avoid">${skill.examples.avoid.map(e => `<li>${e}</li>`).join('')}</ul>
        ` : ''}
      `;
    }
    
    showView('view-detail');
  }

  function showResearchDetail(researchId) {
    const content = PraxiaCurriculum.getContent();
    const research = content?.research?.[researchId];
    if (!research) return;
    
    updateElement('detail-title', research.name);
    updateElement('detail-latin', '');
    updateElement('detail-description', research.description);
    
    const examplesContainer = document.getElementById('detail-examples');
    if (examplesContainer) {
      examplesContainer.innerHTML = `
        <div class="section-label">Effectiveness</div>
        <p class="detail-text">${research.effectiveness}</p>
        <div class="section-label mt-md">Citation</div>
        <p class="detail-citation">${research.citation}</p>
      `;
    }
    
    showView('view-detail');
  }

  // ========================================
  // LUDUS (Playground)
  // ========================================

  function renderLudus() {
    const container = document.getElementById('ludus-activities');
    if (!container) return;

    const user = PraxiaUsers.getActiveUser();
    const assignments = user ? PraxiaCurriculum.getAssignments(user.id) : [];
    
    let html = '';
    
    // Daily activities
    html += `
      <div class="section-label">Daily Activities</div>
      <div class="card action-card" onclick="showView('view-filius-respiro')">
        <div class="card-icon">
          <div class="gradus-mini">
            <div class="gradus-bar"></div>
            <div class="gradus-bar"></div>
            <div class="gradus-bar"></div>
          </div>
        </div>
        <div class="card-content">
          <div class="card-title">Calm Down</div>
          <div class="card-subtitle">Practice Respiro breathing</div>
        </div>
        <span class="chevron">›</span>
      </div>
      <div class="card action-card" onclick="showFiliusMoodCheck()">
        <div class="card-icon">
          <div class="gradus-mini">
            <div class="gradus-bar"></div>
            <div class="gradus-bar"></div>
            <div class="gradus-bar"></div>
          </div>
        </div>
        <div class="card-content">
          <div class="card-title">How Do I Feel?</div>
          <div class="card-subtitle">Check in with your mood</div>
        </div>
        <span class="chevron">›</span>
      </div>
    `;
    
    // Assignments from parents
    if (assignments.length > 0) {
      html += '<div class="section-label mt-lg">From My Parents</div>';
      assignments.forEach(a => {
        const progress = Math.round((a.currentCount / a.targetCount) * 100);
        html += `
          <div class="card assignment-card">
            <div class="assignment-title">${a.title || 'Practice'}</div>
            <div class="assignment-desc">${a.description}</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <div class="assignment-count">${a.currentCount} / ${a.targetCount}</div>
          </div>
        `;
      });
    }
    
    container.innerHTML = html;
  }

  function showFiliusMoodCheck() {
    // Navigate to home where mood grid is shown
    showView('view-filius-home');
  }

  // ========================================
  // ONBOARDING
  // ========================================

  let onboardingStep = 0;

  function renderOnboarding() {
    const user = PraxiaUsers.getActiveUser();
    const role = user?.role || 'custos';
    const content = PraxiaCurriculum.getOnboardingContent(role);
    
    if (!content) {
      completeOnboarding();
      return;
    }
    
    const container = document.getElementById('onboarding-content');
    if (!container) return;
    
    if (onboardingStep === 0) {
      // Welcome screen
      container.innerHTML = `
        <div class="onboarding-welcome">
          <div class="gradus-large">
            <div class="gradus-bar"></div>
            <div class="gradus-bar"></div>
            <div class="gradus-bar"></div>
          </div>
          <h1 class="onboarding-title">${content.welcome.title}</h1>
          <p class="onboarding-subtitle">${content.welcome.subtitle}</p>
          <p class="onboarding-text">${content.welcome.content}</p>
        </div>
      `;
    } else if (onboardingStep <= content.steps.length) {
      const step = content.steps[onboardingStep - 1];
      container.innerHTML = `
        <div class="onboarding-step">
          <div class="onboarding-step-number">${onboardingStep} / ${content.steps.length}</div>
          <h2 class="onboarding-step-title">${step.title}</h2>
          <p class="onboarding-step-content">${step.content}</p>
        </div>
      `;
    }
    
    // Update navigation
    const prevBtn = document.getElementById('onboarding-prev');
    const nextBtn = document.getElementById('onboarding-next');
    const skipBtn = document.getElementById('onboarding-skip');
    
    if (prevBtn) prevBtn.style.display = onboardingStep > 0 ? '' : 'none';
    if (nextBtn) nextBtn.textContent = onboardingStep >= content.steps.length ? '[ Start ]' : '[ Next ]';
    if (skipBtn) skipBtn.style.display = onboardingStep < content.steps.length ? '' : 'none';
  }

  function onboardingNext() {
    const user = PraxiaUsers.getActiveUser();
    const role = user?.role || 'custos';
    const content = PraxiaCurriculum.getOnboardingContent(role);
    
    if (onboardingStep >= (content?.steps?.length || 0)) {
      completeOnboarding();
    } else {
      onboardingStep++;
      renderOnboarding();
    }
  }

  function onboardingPrev() {
    if (onboardingStep > 0) {
      onboardingStep--;
      renderOnboarding();
    }
  }

  function skipOnboarding() {
    completeOnboarding();
  }

  function completeOnboarding() {
    const user = PraxiaUsers.getActiveUser();
    if (user) {
      PraxiaUsers.markOnboardingComplete(user.id);
    }
    onboardingStep = 0;
    navigateToHomeDefault();
  }

  // ========================================
  // SETTINGS
  // ========================================

  let newUserRole = 'custos';

  function renderSettings() {
    const family = PraxiaStorage.get('family') || { name: 'Our Family' };
    const familyNameInput = document.getElementById('settings-family-name');
    if (familyNameInput) familyNameInput.value = family.name;
    
    const settings = PraxiaStorage.get('settings') || {};
    const themeBtn = document.getElementById('settings-theme-btn');
    if (themeBtn) themeBtn.textContent = `[ ${settings.theme === 'light' ? 'LUX' : 'NOX'} ]`;
    
    const durationSelect = document.getElementById('settings-praxis-duration');
    if (durationSelect) durationSelect.value = String(settings.praxisDuration || 900);
    
    const notifToggle = document.getElementById('settings-notifications-toggle');
    if (notifToggle) notifToggle.classList.toggle('active', settings.notificationsEnabled === true);
    
    renderUsersList();
  }

  function renderUsersList() {
    const container = document.getElementById('settings-users-list');
    if (!container) return;
    
    const users = PraxiaUsers.getAllUsers();
    container.innerHTML = users.map(u => `
      <div class="user-item">
        <div class="user-avatar"><span class="user-avatar-text">${u.name.charAt(0).toUpperCase()}</span></div>
        <div class="user-info">
          <div class="user-name">${u.name}</div>
          <div class="user-role">${u.displayLabel || u.role}</div>
        </div>
      </div>
    `).join('');
  }

  function saveFamilyName() {
    const input = document.getElementById('settings-family-name');
    if (!input) return;
    PraxiaUsers.updateFamily({ name: input.value || 'Our Family' });
    showModal('Confirmed', 'Family name updated.');
  }

  function savePraxisDuration() {
    const select = document.getElementById('settings-praxis-duration');
    if (!select) return;
    const settings = PraxiaStorage.get('settings') || {};
    settings.praxisDuration = parseInt(select.value, 10);
    PraxiaStorage.set('settings', settings);
  }

  function toggleNotifications() {
    const toggle = document.getElementById('settings-notifications-toggle');
    const settings = PraxiaStorage.get('settings') || {};
    settings.notificationsEnabled = !settings.notificationsEnabled;
    PraxiaStorage.set('settings', settings);
    if (toggle) toggle.classList.toggle('active', settings.notificationsEnabled);
  }

  function showAddUserModal() {
    document.getElementById('modal-add-user')?.classList.add('active');
    newUserRole = 'custos';
    document.querySelectorAll('.role-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  }

  function hideAddUserModal() {
    document.getElementById('modal-add-user')?.classList.remove('active');
    const nameInput = document.getElementById('new-user-name');
    if (nameInput) nameInput.value = '';
  }

  function selectNewUserRole(role, btn) {
    newUserRole = role;
    document.querySelectorAll('.role-btn').forEach(b => b.classList.toggle('active', b === btn));
  }

  function addNewUser() {
    const nameInput = document.getElementById('new-user-name');
    const name = nameInput?.value?.trim();
    if (!name) {
      showModal('Error', 'Please enter a name.');
      return;
    }
    PraxiaUsers.createUser({ 
      role: newUserRole, 
      name, 
      displayLabel: newUserRole === 'custos' ? 'Custos' : 'Filius' 
    });
    hideAddUserModal();
    renderUsersList();
    showModal('Confirmed', `${name} added to family.`);
  }

  function exportData() {
    const data = {
      family: PraxiaStorage.get('family'),
      users: PraxiaUsers.getAllUsers(),
      sessions: PraxiaStorage.getAll('sessions'),
      episodes: PraxiaStorage.getAll('episodes'),
      curriculumProgress: PraxiaStorage.get('curriculumProgress'),
      settings: PraxiaStorage.get('settings'),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `praxia-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showModal('Confirmed', 'Data exported successfully.');
  }

  function confirmResetProgress() {
    document.getElementById('modal-reset')?.classList.add('active');
  }

  function hideResetModal() {
    document.getElementById('modal-reset')?.classList.remove('active');
  }

  function executeReset() {
    PraxiaStorage.clearKey('sessions');
    PraxiaStorage.clearKey('episodes');
    PraxiaStorage.clearKey('statusCheckins');
    PraxiaStorage.clearKey('moodCheckins');
    PraxiaStorage.clearKey('respiroCompletions');
    PraxiaStorage.clearKey('assignments');
    PraxiaStorage.set('curriculumProgress', { currentWeek: 1, completedLessons: [] });
    
    const users = PraxiaUsers.getAllUsers();
    users.forEach(u => {
      PraxiaStorage.remove(`achievements_${u.id}`);
      PraxiaStorage.remove(`points_${u.id}`);
      PraxiaUsers.updateUser(u.id, { 
        progress: { points: 0, level: 1, streak: 0, lastSessionDate: null },
        achievements: []
      });
    });
    
    hideResetModal();
    showModal('Confirmed', 'All progress has been reset.');
    updateDashboard();
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
    updateDashboard,
    // Curriculum / Schola
    selectPhase,
    openLesson,
    toggleLessonComplete,
    // Bibliotheca
    showSkillDetail,
    showResearchDetail,
    // Ludus
    showFiliusMoodCheck,
    // Onboarding
    onboardingNext,
    onboardingPrev,
    skipOnboarding,
    // Settings
    saveFamilyName,
    savePraxisDuration,
    toggleNotifications,
    showAddUserModal,
    hideAddUserModal,
    selectNewUserRole,
    addNewUser,
    exportData,
    confirmResetProgress,
    hideResetModal,
    executeReset
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
// Curriculum / Schola
window.selectPhase = Praxia.selectPhase;
window.openLesson = Praxia.openLesson;
window.toggleLessonComplete = Praxia.toggleLessonComplete;
// Bibliotheca
window.showSkillDetail = Praxia.showSkillDetail;
window.showResearchDetail = Praxia.showResearchDetail;
// Ludus
window.showFiliusMoodCheck = Praxia.showFiliusMoodCheck;
// Onboarding
window.onboardingNext = Praxia.onboardingNext;
window.onboardingPrev = Praxia.onboardingPrev;
window.skipOnboarding = Praxia.skipOnboarding;
// Settings
window.saveFamilyName = Praxia.saveFamilyName;
window.savePraxisDuration = Praxia.savePraxisDuration;
window.toggleNotifications = Praxia.toggleNotifications;
window.showAddUserModal = Praxia.showAddUserModal;
window.hideAddUserModal = Praxia.hideAddUserModal;
window.selectNewUserRole = Praxia.selectNewUserRole;
window.addNewUser = Praxia.addNewUser;
window.exportData = Praxia.exportData;
window.confirmResetProgress = Praxia.confirmResetProgress;
window.hideResetModal = Praxia.hideResetModal;
window.executeReset = Praxia.executeReset;
