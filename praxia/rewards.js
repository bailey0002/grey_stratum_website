/**
 * Praxia Rewards Module
 * Handles achievements, streaks, points, and unlockables
 */

const PraxiaRewards = (function() {
  'use strict';

  let rewardsData = null;

  /**
   * Load rewards config
   */
  async function loadRewards() {
    if (rewardsData) return rewardsData;
    try {
      const response = await fetch('./rewards.json');
      rewardsData = await response.json();
      return rewardsData;
    } catch (e) {
      console.error('[Rewards] Load error:', e);
      return null;
    }
  }

  function getRewardsConfig() {
    return rewardsData;
  }

  /**
   * Alias for getRewardsConfig (backward compatibility)
   */
  function getRewards() {
    return rewardsData;
  }

  /**
   * Calculate streak from sessions
   */
  function calculateStreak(userId) {
    const sessions = PraxiaStorage.query('sessions', { userId });
    if (!sessions.length) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dates = [...new Set(sessions.map(s => {
      const d = new Date(s.date || s.createdAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }))].sort((a, b) => b - a);

    let streak = 0;
    let checkDate = today.getTime();
    const DAY_MS = 86400000;

    for (const date of dates) {
      if (date === checkDate || date === checkDate - DAY_MS) {
        streak++;
        checkDate = date;
      } else if (date < checkDate - DAY_MS) {
        break;
      }
    }

    return streak;
  }

  /**
   * Update user's streak
   */
  function updateStreak(userId) {
    const streak = calculateStreak(userId);
    PraxiaUsers.updateUserProgress(userId, { 
      streak,
      lastSessionDate: new Date().toISOString().split('T')[0]
    });
    
    // Check streak milestones
    checkStreakMilestones(userId, streak);
    
    return streak;
  }

  /**
   * Check and award streak achievements
   */
  function checkStreakMilestones(userId, streak) {
    if (!rewardsData) return;
    
    const milestones = rewardsData.streakSystem?.milestones || [];
    const user = PraxiaUsers.getUser(userId);
    const earned = user?.achievements || [];
    
    for (const milestone of milestones) {
      if (streak >= milestone.days && !earned.includes(milestone.reward)) {
        awardAchievement(userId, milestone.reward);
      }
    }
  }

  /**
   * Get all achievements for a role
   */
  function getAchievements(role = 'custos') {
    return rewardsData?.achievements?.[role] || [];
  }

  /**
   * Check if user has earned an achievement
   */
  function hasAchievement(userId, achievementId) {
    const user = PraxiaUsers.getUser(userId);
    return user?.achievements?.includes(achievementId) || false;
  }

  /**
   * Award an achievement to user
   */
  function awardAchievement(userId, achievementId) {
    const user = PraxiaUsers.getUser(userId);
    if (!user || hasAchievement(userId, achievementId)) return null;

    const achievements = [...(user.achievements || []), achievementId];
    PraxiaUsers.updateUser(userId, { achievements });

    // Find achievement data for points
    const allAchievements = [
      ...(rewardsData?.achievements?.custos || []),
      ...(rewardsData?.achievements?.filius || []),
      ...(rewardsData?.achievements?.family || [])
    ];
    const achievement = allAchievements.find(a => a.id === achievementId);
    
    if (achievement?.points) {
      PraxiaUsers.addPoints(userId, achievement.points);
    }

    return achievement;
  }

  /**
   * Check all achievements for potential unlocks
   */
  function checkAchievements(userId) {
    const user = PraxiaUsers.getUser(userId);
    if (!user) return [];

    const roleAchievements = getAchievements(user.role);
    const newAchievements = [];

    for (const achievement of roleAchievements) {
      if (hasAchievement(userId, achievement.id)) continue;
      
      if (checkAchievementCriteria(userId, achievement.criteria)) {
        const awarded = awardAchievement(userId, achievement.id);
        if (awarded) newAchievements.push(awarded);
      }
    }

    return newAchievements;
  }

  /**
   * Check if achievement criteria is met
   */
  function checkAchievementCriteria(userId, criteria) {
    if (!criteria) return false;

    switch (criteria.type) {
      case 'sessions':
        const sessions = PraxiaStorage.query('sessions', { userId });
        return sessions.length >= criteria.count;
        
      case 'skill-count':
        const skillSessions = PraxiaStorage.query('sessions', { userId });
        const total = skillSessions.reduce((sum, s) => 
          sum + (s.skills?.[criteria.skill] || 0), 0);
        return total >= criteria.count;
        
      case 'checkins':
        const checkins = PraxiaStorage.query('moodCheckins', { userId });
        return checkins.length >= criteria.count;
        
      case 'respiro-count':
        const respiros = PraxiaStorage.query('respiroCompletions', { userId });
        return respiros.length >= criteria.count;
        
      case 'phase-complete':
        const progress = PraxiaCurriculum.getUserProgress(userId);
        const phase = PraxiaCurriculum.getPhase(criteria.phase);
        if (!phase) return false;
        const completedInPhase = progress.completedLessons.filter(
          id => phase.lessons?.some(l => l.id === id)
        ).length;
        return completedInPhase >= (phase.lessons?.length || 0);
        
      default:
        return false;
    }
  }

  /**
   * Get user's unlocked rewards
   */
  function getUnlockedRewards(userId) {
    const user = PraxiaUsers.getUser(userId);
    if (!user || !rewardsData) return { themes: [], gradusStyles: [], sounds: [] };

    const unlocked = { themes: [], gradusStyles: [], sounds: [] };
    const points = user.progress?.points || 0;
    const streak = user.progress?.streak || 0;
    const achievements = user.achievements || [];

    // Check themes
    for (const theme of (rewardsData.unlockables?.themes || [])) {
      if (checkUnlockCriteria(theme.unlockCriteria, { points, streak, achievements })) {
        unlocked.themes.push(theme);
      }
    }

    // Check gradus styles
    for (const style of (rewardsData.unlockables?.gradusStyles || [])) {
      if (checkUnlockCriteria(style.unlockCriteria, { points, streak, achievements })) {
        unlocked.gradusStyles.push(style);
      }
    }

    // Check sounds
    for (const sound of (rewardsData.unlockables?.sounds || [])) {
      if (checkUnlockCriteria(sound.unlockCriteria, { points, streak, achievements })) {
        unlocked.sounds.push(sound);
      }
    }

    return unlocked;
  }

  /**
   * Check unlock criteria
   */
  function checkUnlockCriteria(criteria, userStats) {
    if (!criteria) return true;
    
    switch (criteria.type) {
      case 'points':
        return userStats.points >= criteria.count;
      case 'streak':
        return userStats.streak >= criteria.days;
      case 'achievement':
        return userStats.achievements.includes(criteria.id);
      default:
        return false;
    }
  }

  /**
   * Get level info for points
   */
  function getLevelInfo(points) {
    const levels = rewardsData?.levelSystem?.levels || [];
    let currentLevel = levels[0];
    let nextLevel = levels[1];

    for (let i = levels.length - 1; i >= 0; i--) {
      if (points >= levels[i].pointsRequired) {
        currentLevel = levels[i];
        nextLevel = levels[i + 1] || null;
        break;
      }
    }

    const pointsInLevel = points - currentLevel.pointsRequired;
    const pointsToNext = nextLevel ? nextLevel.pointsRequired - currentLevel.pointsRequired : 0;
    const progress = nextLevel ? Math.round((pointsInLevel / pointsToNext) * 100) : 100;

    return {
      current: currentLevel,
      next: nextLevel,
      pointsInLevel,
      pointsToNext,
      progress
    };
  }

  /**
   * Calculate points for an action
   */
  function getPointsForAction(action, count = 1) {
    const economy = rewardsData?.pointsEconomy || {};
    return (economy[action] || 0) * count;
  }

  return {
    loadRewards,
    getRewardsConfig,
    getRewards,
    calculateStreak,
    updateStreak,
    getAchievements,
    hasAchievement,
    awardAchievement,
    checkAchievements,
    getUnlockedRewards,
    getLevelInfo,
    getPointsForAction
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PraxiaRewards;
}
