/**
 * Praxia Curriculum Module
 * Handles lesson progression, phase unlocking, and assignment management
 */

const PraxiaCurriculum = (function() {
  'use strict';

  let curriculumData = null;
  let skillsData = null;
  let contentData = null;

  /**
   * Load curriculum from config
   */
  async function loadCurriculum() {
    if (curriculumData) return curriculumData;
    
    try {
      const response = await fetch('./curriculum.json');
      curriculumData = await response.json();
      return curriculumData;
    } catch (e) {
      console.error('[Curriculum] Load error:', e);
      return null;
    }
  }
  
  /**
   * Load skills data
   */
  async function loadSkills() {
    if (skillsData) return skillsData;
    
    try {
      const response = await fetch('./skills.json');
      skillsData = await response.json();
      return skillsData;
    } catch (e) {
      console.error('[Skills] Load error:', e);
      return null;
    }
  }
  
  /**
   * Load content data
   */
  async function loadContent() {
    if (contentData) return contentData;
    
    try {
      const response = await fetch('./content.json');
      contentData = await response.json();
      return contentData;
    } catch (e) {
      console.error('[Content] Load error:', e);
      return null;
    }
  }

  /**
   * Get curriculum synchronously (must be loaded first)
   */
  function getCurriculum() {
    return curriculumData;
  }
  
  function getSkills() {
    return skillsData;
  }
  
  function getContent() {
    return contentData;
  }
  
  /**
   * Get PRIDE skills data
   */
  function getPrideSkills() {
    return skillsData?.prideSkills || {};
  }
  
  /**
   * Get Respiro steps
   */
  function getRespiroSteps() {
    return skillsData?.respiroSteps || [];
  }
  
  /**
   * Get emotion vocabulary
   */
  function getEmotionVocabulary() {
    return skillsData?.emotionVocabulary || {};
  }
  
  /**
   * Get urgentia scripts
   */
  function getUrgentiaScripts() {
    return skillsData?.urgentiaScripts || [];
  }

  /**
   * Get all phases
   */
  function getPhases() {
    return curriculumData?.phases || [];
  }

  /**
   * Get a specific phase by ID
   */
  function getPhase(phaseId) {
    return getPhases().find(p => p.id === phaseId) || null;
  }

  /**
   * Get all lessons for a phase
   */
  function getLessonsForPhase(phaseId) {
    const phase = getPhase(phaseId);
    return phase?.lessons || [];
  }
  
  /**
   * Get lessons for a specific week
   */
  function getLessonsForWeek(week) {
    const phases = getPhases();
    for (const phase of phases) {
      if (phase.weeks.includes(week)) {
        return phase.lessons.filter(l => l.week === week);
      }
    }
    return [];
  }
  
  /**
   * Get phase for a specific week
   */
  function getPhaseForWeek(week) {
    return getPhases().find(p => p.weeks.includes(week)) || null;
  }

  /**
   * Get a specific lesson by ID
   */
  function getLesson(lessonId) {
    for (const phase of getPhases()) {
      const lesson = phase.lessons?.find(l => l.id === lessonId);
      if (lesson) return { ...lesson, phase: phase.id, phaseName: phase.name };
    }
    return null;
  }

  /**
   * Get user's current curriculum progress
   */
  function getUserProgress(userId) {
    const user = PraxiaUsers.getUser(userId);
    return user?.curriculumProgress || {
      currentPhase: 'fundamentum',
      currentLesson: 'F1',
      completedLessons: []
    };
  }
  
  /**
   * Get global curriculum progress (used when not tied to specific user)
   */
  function getGlobalProgress() {
    return PraxiaStorage.get('curriculumProgress') || {
      currentWeek: 1,
      completedLessons: []
    };
  }
  
  /**
   * Update global curriculum progress
   */
  function updateGlobalProgress(updates) {
    const current = getGlobalProgress();
    const updated = { ...current, ...updates };
    PraxiaStorage.set('curriculumProgress', updated);
    return updated;
  }

  /**
   * Check if a phase is unlocked for user
   */
  function isPhaseUnlocked(userId, phaseId) {
    const phase = getPhase(phaseId);
    if (!phase || !phase.unlockCriteria) return true;
    
    const progress = getUserProgress(userId);
    const criteria = phase.unlockCriteria;
    
    // Check if previous phase is complete
    if (criteria.phase) {
      const prevPhase = getPhase(criteria.phase);
      const completedInPhase = progress.completedLessons.filter(
        id => prevPhase.lessons.some(l => l.id === id)
      ).length;
      if (completedInPhase < (prevPhase.lessons?.length || 0)) {
        return false;
      }
    }
    
    // Check session count
    if (criteria.sessionsCompleted) {
      const sessions = PraxiaStorage.query('sessions', { userId });
      if (sessions.length < criteria.sessionsCompleted) {
        return false;
      }
    }
    
    // Check skill thresholds
    if (criteria.skillThresholds) {
      const sessions = PraxiaStorage.query('sessions', { userId });
      const totals = sessions.reduce((acc, s) => {
        Object.keys(s.skills || {}).forEach(skill => {
          acc[skill] = (acc[skill] || 0) + (s.skills[skill] || 0);
        });
        return acc;
      }, {});
      
      for (const [skill, threshold] of Object.entries(criteria.skillThresholds)) {
        if ((totals[skill] || 0) < threshold) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Check if a lesson is available for user
   */
  function isLessonAvailable(userId, lessonId) {
    const lesson = getLesson(lessonId);
    if (!lesson) return false;
    
    // Check phase is unlocked
    if (!isPhaseUnlocked(userId, lesson.phase)) return false;
    
    const progress = getUserProgress(userId);
    
    // First lesson in phase is always available if phase is unlocked
    const phaseLessons = getLessonsForPhase(lesson.phase);
    if (phaseLessons[0]?.id === lessonId) return true;
    
    // Check if previous lesson is completed
    const lessonIndex = phaseLessons.findIndex(l => l.id === lessonId);
    if (lessonIndex > 0) {
      const prevLessonId = phaseLessons[lessonIndex - 1].id;
      return progress.completedLessons.includes(prevLessonId);
    }
    
    return true;
  }
  
  /**
   * Check if a lesson is complete
   */
  function isLessonComplete(lessonId) {
    const progress = getGlobalProgress();
    return progress.completedLessons.includes(lessonId);
  }

  /**
   * Mark a lesson as completed
   */
  function completeLesson(userId, lessonId) {
    // Update global progress
    const globalProgress = getGlobalProgress();
    if (!globalProgress.completedLessons.includes(lessonId)) {
      globalProgress.completedLessons.push(lessonId);
      PraxiaStorage.set('curriculumProgress', globalProgress);
    }
    
    // Update user-specific progress if custos
    const user = PraxiaUsers.getUser(userId);
    if (!user) return null;
    
    if (user.role === 'custos') {
      const progress = user.curriculumProgress || {
        currentPhase: 'fundamentum',
        currentLesson: lessonId,
        completedLessons: []
      };
      
      if (!progress.completedLessons.includes(lessonId)) {
        progress.completedLessons.push(lessonId);
      }
      
      // Find next lesson
      const lesson = getLesson(lessonId);
      if (lesson) {
        const phaseLessons = getLessonsForPhase(lesson.phase);
        const currentIndex = phaseLessons.findIndex(l => l.id === lessonId);
        
        if (currentIndex < phaseLessons.length - 1) {
          progress.currentLesson = phaseLessons[currentIndex + 1].id;
        } else {
          // Move to next phase
          const phases = getPhases();
          const phaseIndex = phases.findIndex(p => p.id === lesson.phase);
          if (phaseIndex < phases.length - 1) {
            const nextPhase = phases[phaseIndex + 1];
            progress.currentPhase = nextPhase.id;
            progress.currentLesson = nextPhase.lessons?.[0]?.id || null;
          }
        }
      }
      
      PraxiaUsers.updateUser(userId, { curriculumProgress: progress });
    }
    
    // Award points
    const lessonData = getLesson(lessonId);
    const points = lessonData?.type === 'integration' ? 25 : 15;
    PraxiaUsers.addPoints(userId, points);
    
    return getGlobalProgress();
  }
  
  /**
   * Uncomplete a lesson
   */
  function uncompleteLesson(lessonId) {
    const globalProgress = getGlobalProgress();
    const index = globalProgress.completedLessons.indexOf(lessonId);
    if (index > -1) {
      globalProgress.completedLessons.splice(index, 1);
      PraxiaStorage.set('curriculumProgress', globalProgress);
    }
    return globalProgress;
  }

  /**
   * Get next recommended lesson for user
   */
  function getNextLesson(userId) {
    const progress = getUserProgress(userId);
    
    if (progress.currentLesson && isLessonAvailable(userId, progress.currentLesson)) {
      return getLesson(progress.currentLesson);
    }
    
    // Find first available uncompleted lesson
    for (const phase of getPhases()) {
      if (!isPhaseUnlocked(userId, phase.id)) continue;
      
      for (const lesson of (phase.lessons || [])) {
        if (!progress.completedLessons.includes(lesson.id)) {
          return { ...lesson, phase: phase.id };
        }
      }
    }
    
    return null;
  }

  /**
   * Create an assignment for a child
   */
  function createAssignment(createdBy, assignedTo, assignmentData) {
    const assignment = {
      id: PraxiaStorage.generateId(),
      createdAt: new Date().toISOString(),
      createdBy,
      assignedTo,
      type: assignmentData.type || 'practice',
      title: assignmentData.title || 'Practice Assignment',
      description: assignmentData.description,
      targetCount: assignmentData.targetCount || 1,
      currentCount: 0,
      dueDate: assignmentData.dueDate || null,
      completed: false,
      completedAt: null,
      lessonId: assignmentData.lessonId || null,
      skill: assignmentData.skill || null
    };
    
    return PraxiaStorage.append('assignments', assignment);
  }

  /**
   * Update assignment progress
   */
  function updateAssignmentProgress(assignmentId, increment = 1) {
    const assignments = PraxiaStorage.getAll('assignments');
    const assignment = assignments.find(a => a.id === assignmentId);
    
    if (!assignment) return null;
    
    assignment.currentCount = (assignment.currentCount || 0) + increment;
    
    if (assignment.currentCount >= assignment.targetCount) {
      assignment.completed = true;
      assignment.completedAt = new Date().toISOString();
      
      // Award points
      PraxiaUsers.addPoints(assignment.assignedTo, 20);
      
      // Check achievements
      if (typeof PraxiaRewards !== 'undefined') {
        PraxiaRewards.checkAchievements(assignment.assignedTo);
      }
    }
    
    PraxiaStorage.update('assignments', assignmentId, assignment);
    return assignment;
  }

  /**
   * Get assignments for a user
   */
  function getAssignments(userId, includeCompleted = false) {
    const assignments = PraxiaStorage.getAll('assignments');
    return assignments.filter(a => 
      a.assignedTo === userId && (includeCompleted || !a.completed)
    );
  }
  
  /**
   * Get assignments created by a user
   */
  function getCreatedAssignments(userId) {
    const assignments = PraxiaStorage.getAll('assignments');
    return assignments.filter(a => a.createdBy === userId);
  }

  /**
   * Calculate overall progress percentage
   */
  function calculateOverallProgress(userId) {
    const progress = getUserProgress(userId);
    const allLessons = getPhases().flatMap(p => p.lessons || []);
    const completed = progress.completedLessons.length;
    return Math.round((completed / allLessons.length) * 100);
  }
  
  /**
   * Calculate phase progress
   */
  function calculatePhaseProgress(phaseId) {
    const phase = getPhase(phaseId);
    if (!phase) return 0;
    
    const progress = getGlobalProgress();
    const phaseLessons = phase.lessons || [];
    const completed = phaseLessons.filter(l => 
      progress.completedLessons.includes(l.id)
    ).length;
    
    return Math.round((completed / phaseLessons.length) * 100);
  }
  
  /**
   * Get skill prompt for session
   */
  function getSkillPrompts() {
    const prideSkills = getPrideSkills();
    const prompts = [];
    
    for (const [skillId, skill] of Object.entries(prideSkills)) {
      if (skill.prompts) {
        skill.prompts.forEach(prompt => {
          prompts.push({
            skill: skillId,
            text: prompt.text,
            hint: prompt.hint
          });
        });
      }
    }
    
    return prompts;
  }
  
  /**
   * Get help content for a topic
   */
  function getHelpContent(topic) {
    return contentData?.help?.[topic] || null;
  }
  
  /**
   * Get onboarding content for a role
   */
  function getOnboardingContent(role) {
    return contentData?.onboarding?.[role] || null;
  }
  
  /**
   * Get research info
   */
  function getResearchInfo(topic) {
    return contentData?.research?.[topic] || null;
  }

  return {
    loadCurriculum,
    loadSkills,
    loadContent,
    getCurriculum,
    getSkills,
    getContent,
    getPrideSkills,
    getRespiroSteps,
    getEmotionVocabulary,
    getUrgentiaScripts,
    getPhases,
    getPhase,
    getPhaseForWeek,
    getLessonsForPhase,
    getLessonsForWeek,
    getLesson,
    getUserProgress,
    getGlobalProgress,
    updateGlobalProgress,
    isPhaseUnlocked,
    isLessonAvailable,
    isLessonComplete,
    completeLesson,
    uncompleteLesson,
    getNextLesson,
    createAssignment,
    updateAssignmentProgress,
    getAssignments,
    getCreatedAssignments,
    calculateOverallProgress,
    calculatePhaseProgress,
    getSkillPrompts,
    getHelpContent,
    getOnboardingContent,
    getResearchInfo
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PraxiaCurriculum;
}
