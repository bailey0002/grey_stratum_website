/**
 * Praxia Users Module
 * Handles user profiles, family structure, and role management
 */

const PraxiaUsers = (function() {
  'use strict';

  // Default roles as fallback
  let rolesConfig = {
    custos: {
      id: 'custos',
      name: 'Custos',
      displayName: 'Parent',
      defaultView: 'view-custos-home',
      permissions: ['manage-children', 'view-all-progress', 'create-assignments', 'access-consilium', 'access-schola', 'access-bibliotheca']
    },
    filius: {
      id: 'filius',
      name: 'Filius',
      displayName: 'Child',
      defaultView: 'view-filius-home',
      permissions: ['view-own-progress', 'complete-activities', 'earn-rewards', 'access-ludus', 'access-bibliotheca']
    }
  };

  /**
   * Load roles configuration from users.json
   */
  async function loadRoles() {
    try {
      const response = await fetch('./users.json');
      const data = await response.json();
      if (data && data.roles) {
        rolesConfig = data.roles;
      }
      return rolesConfig;
    } catch (e) {
      console.warn('[Users] Load error, using defaults:', e);
      return rolesConfig;
    }
  }

  function getRoles() {
    return rolesConfig;
  }
  
  function getRole(roleId) {
    return rolesConfig[roleId] || null;
  }

  function initializeFamily(familyName) {
    const familyId = PraxiaStorage.generateId();
    const family = {
      id: familyId,
      name: familyName || 'Our Family',
      createdAt: new Date().toISOString(),
      members: [],
      settings: {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        weekStartsOn: 0,
        reminderTime: '18:00'
      },
      sharedProgress: {
        familyStreak: 0,
        familyPoints: 0,
        familyAchievements: []
      }
    };
    PraxiaStorage.set('family', family);
    return family;
  }

  function createUser(userData) {
    const data = PraxiaStorage.load();
    if (!data.family) {
      initializeFamily();
      data.family = PraxiaStorage.get('family');
    }

    const userId = PraxiaStorage.generateId();
    const role = rolesConfig[userData.role] || rolesConfig.custos;
    
    const user = {
      id: userId,
      familyId: data.family.id,
      role: userData.role || 'custos',
      name: userData.name || role.displayName,
      displayLabel: userData.displayLabel || role.name,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      settings: {
        theme: 'dark',
        soundEnabled: true,
        ...userData.settings
      },
      progress: {
        points: 0,
        level: 1,
        streak: 0,
        lastSessionDate: null
      },
      achievements: [],
      onboardingComplete: false
    };

    if (userData.role === 'filius') {
      user.age = userData.age || null;
      user.avatar = userData.avatar || 'default';
      user.assignments = [];
      user.linkedCustodes = [];
    } else {
      user.linkedChildren = [];
      user.curriculumProgress = {
        currentPhase: 'fundamentum',
        currentLesson: 'F1',
        completedLessons: []
      };
    }

    data.users[userId] = user;
    data.family.members.push({
      userId,
      role: user.role,
      joinedAt: user.createdAt
    });
    
    if (!data.activeUserId) {
      data.activeUserId = userId;
    }
    
    PraxiaStorage.save(data);
    return user;
  }

  function getUser(userId) {
    const data = PraxiaStorage.load();
    return data.users[userId] || null;
  }

  function getActiveUser() {
    const data = PraxiaStorage.load();
    return data.activeUserId ? data.users[data.activeUserId] : null;
  }

  function setActiveUser(userId) {
    const data = PraxiaStorage.load();
    if (data.users[userId]) {
      data.activeUserId = userId;
      data.users[userId].lastActive = new Date().toISOString();
      PraxiaStorage.save(data);
      return data.users[userId];
    }
    return null;
  }

  function updateUser(userId, updates) {
    const data = PraxiaStorage.load();
    if (data.users[userId]) {
      data.users[userId] = {
        ...data.users[userId],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      PraxiaStorage.save(data);
      return data.users[userId];
    }
    return null;
  }

  function getAllUsers() {
    const data = PraxiaStorage.load();
    return Object.values(data.users || {});
  }

  function getUsersByRole(role) {
    return getAllUsers().filter(u => u.role === role);
  }

  function getFamily() {
    return PraxiaStorage.get('family');
  }
  
  function updateFamily(updates) {
    const family = getFamily();
    if (!family) return null;
    const updated = { ...family, ...updates };
    PraxiaStorage.set('family', updated);
    return updated;
  }

  function updateUserProgress(userId, progressUpdates) {
    const user = getUser(userId);
    if (!user) return null;
    const newProgress = { ...user.progress, ...progressUpdates };
    return updateUser(userId, { progress: newProgress });
  }

  function addPoints(userId, points) {
    const user = getUser(userId);
    if (!user) return null;
    const newPoints = (user.progress?.points || 0) + points;
    const newLevel = calculateLevel(newPoints);
    
    // Also update family points
    const family = getFamily();
    if (family) {
      family.sharedProgress.familyPoints = (family.sharedProgress.familyPoints || 0) + points;
      PraxiaStorage.set('family', family);
    }
    
    return updateUserProgress(userId, { points: newPoints, level: newLevel });
  }

  function calculateLevel(points) {
    const levels = [0, 50, 150, 300, 500, 750, 1000, 1500, 2000, 3000];
    for (let i = levels.length - 1; i >= 0; i--) {
      if (points >= levels[i]) return i + 1;
    }
    return 1;
  }
  
  function getLevelProgress(points) {
    const levels = [0, 50, 150, 300, 500, 750, 1000, 1500, 2000, 3000];
    const currentLevel = calculateLevel(points);
    const currentThreshold = levels[currentLevel - 1] || 0;
    const nextThreshold = levels[currentLevel] || levels[levels.length - 1];
    const pointsInLevel = points - currentThreshold;
    const pointsNeeded = nextThreshold - currentThreshold;
    return {
      level: currentLevel,
      points,
      pointsInLevel,
      pointsNeeded,
      progress: Math.round((pointsInLevel / pointsNeeded) * 100)
    };
  }

  function hasPermission(userId, permission) {
    const user = getUser(userId);
    if (!user) return false;
    const role = rolesConfig[user.role];
    return role && role.permissions.includes(permission);
  }
  
  function activeUserHasPermission(permission) {
    const user = getActiveUser();
    if (!user) return false;
    return hasPermission(user.id, permission);
  }

  function linkChildToParent(parentId, childId) {
    const data = PraxiaStorage.load();
    const parent = data.users[parentId];
    const child = data.users[childId];
    
    if (!parent || !child || parent.role !== 'custos' || child.role !== 'filius') {
      return false;
    }
    
    if (!parent.linkedChildren) parent.linkedChildren = [];
    if (!child.linkedCustodes) child.linkedCustodes = [];
    
    if (!parent.linkedChildren.includes(childId)) {
      parent.linkedChildren.push(childId);
    }
    if (!child.linkedCustodes.includes(parentId)) {
      child.linkedCustodes.push(parentId);
    }
    
    PraxiaStorage.save(data);
    return true;
  }
  
  function getLinkedChildren(parentId) {
    const parent = getUser(parentId);
    if (!parent || !parent.linkedChildren) return [];
    return parent.linkedChildren.map(id => getUser(id)).filter(Boolean);
  }
  
  function markOnboardingComplete(userId) {
    return updateUser(userId, { onboardingComplete: true });
  }
  
  function isOnboardingComplete(userId) {
    const user = getUser(userId);
    return user?.onboardingComplete === true;
  }

  return {
    loadRoles,
    getRoles,
    getRole,
    initializeFamily,
    createUser,
    getUser,
    getActiveUser,
    setActiveUser,
    updateUser,
    getAllUsers,
    getUsersByRole,
    getFamily,
    updateFamily,
    updateUserProgress,
    addPoints,
    calculateLevel,
    getLevelProgress,
    hasPermission,
    activeUserHasPermission,
    linkChildToParent,
    getLinkedChildren,
    markOnboardingComplete,
    isOnboardingComplete
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PraxiaUsers;
}
