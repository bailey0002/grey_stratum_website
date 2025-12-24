/**
 * Praxia Curriculum Module
 * Handles lesson progression, phase unlocking, and assignment management
 */

const PraxiaCurriculum = (function() {
  'use strict';

  let curriculumData = null;

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
   * Get curriculum synchronously (must be loaded first)
   */
  function getCurriculum() {
    return curriculumData;
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
   * Get a specific lesson by ID
   */
  function getLesson(lessonId) {
    for (const phase of getPhases()) {
      const lesson = phase.lessons?.find(l => l.id === lessonId);
      if (lesson) return { ...lesson, phase: phase.id };
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
   * Check if a phase is unlocked for user
   */
  function isPhaseUnlocked(userId, phaseId) {
    const phase = getPhase(phaseId);
    if (!phase || !phase.unlockCriteria) return true; // First phase is always unlocked
    
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
   * Mark a lesson as completed
   */
  function completeLesson(userId, lessonId) {
    const user = PraxiaUsers.getUser(userId);
    if (!user) return null;
    
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
    
    // Award points
    const lessonData = getLesson(lessonId);
    const points = lessonData?.type === 'integration' ? 25 : 15;
    PraxiaUsers.addPoints(userId, points);
    
    return progress;
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
      description: assignmentData.description,
      targetCount: assignmentData.targetCount || 1,
      currentCount: 0,
      dueDate: assignmentData.dueDate || null,
      completed: false,
      completedAt: null,
      lessonId: assignmentData.lessonId || null
    };
    
    return PraxiaStorage.append('assignments', assignment);
  }

  /**
   * Update assignment progress
   */
  function updateAssignmentProgress(assignmentId, increment = 1) {
    const data = PraxiaStorage.load();
    const assignment = data.assignments.find(a => a.id === assignmentId);
    
    if (!assignment) return null;
    
    assignment.currentCount = (assignment.currentCount || 0) + increment;
    
    if (assignment.currentCount >= assignment.targetCount) {
      assignment.completed = true;
      assignment.completedAt = new Date().toISOString();
      
      // Award points
      PraxiaUsers.addPoints(assignment.assignedTo, 20);
    }
    
    PraxiaStorage.save(data);
    return assignment;
  }

  /**
   * Get assignments for a user
   */
  function getAssignments(userId, includeCompleted = false) {
    const assignments = PraxiaStorage.query('assignments', {});
    return assignments.filter(a => 
      a.assignedTo === userId && (includeCompleted || !a.completed)
    );
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

  return {
    loadCurriculum,
    getCurriculum,
    getPhases,
    getPhase,
    getLessonsForPhase,
    getLesson,
    getUserProgress,
    isPhaseUnlocked,
    isLessonAvailable,
    completeLesson,
    getNextLesson,
    createAssignment,
    updateAssignmentProgress,
    getAssignments,
    calculateOverallProgress
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PraxiaCurriculum;
}
