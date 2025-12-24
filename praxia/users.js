/**
 * Praxia Users Module
 * Handles user profiles, family structure, and role management
 */

const PraxiaUsers = (function() {
  'use strict';

  const ROLES = {
    custos: {
      id: 'custos',
      name: 'Custos',
      displayName: 'Parent',
      defaultView: 'custos-home',
      permissions: ['manage-children', 'view-all-progress', 'create-assignments', 'access-consilium']
    },
    filius: {
      id: 'filius',
      name: 'Filius',
      displayName: 'Child',
      defaultView: 'filius-home',
      permissions: ['view-own-progress', 'complete-activities', 'earn-rewards']
    }
  };

  function initializeFamily(familyName) {
    const familyId = PraxiaStorage.generateId();
    const family = {
      id: familyId,
      name: familyName || 'Our Family',
      createdAt: new Date().toISOString(),
      members: [],
      settings: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, weekStartsOn: 0, reminderTime: '18:00' },
      sharedProgress: { familyStreak: 0, familyPoints: 0, familyAchievements: [] }
    };
    PraxiaStorage.set('family', family);
    return family;
  }

  function createUser(userData) {
    const data = PraxiaStorage.load();
    if (!data.family) { initializeFamily(); data.family = PraxiaStorage.get('family'); }

    const userId = PraxiaStorage.generateId();
    const role = ROLES[userData.role] || ROLES.custos;
    
    const user = {
      id: userId,
      familyId: data.family.id,
      role: userData.role || 'custos',
      name: userData.name || role.displayName,
      displayLabel: userData.displayLabel || role.name,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      settings: { theme: 'dark', soundEnabled: true, ...userData.settings },
      progress: { points: 0, level: 1, streak: 0, lastSessionDate: null },
      achievements: []
    };

    if (userData.role === 'filius') {
      user.age = userData.age || null;
      user.avatar = userData.avatar || 'default';
      user.assignments = [];
    } else {
      user.linkedChildren = [];
      user.curriculumProgress = { currentPhase: 'fundamentum', currentLesson: 'F1', completedLessons: [] };
    }

    data.users[userId] = user;
    data.family.members.push({ userId, role: user.role, joinedAt: user.createdAt });
    
    if (!data.activeUserId) { data.activeUserId = userId; }
    
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
      data.users[userId] = { ...data.users[userId], ...updates, updatedAt: new Date().toISOString() };
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

  function updateUserProgress(userId, progressUpdates) {
    const user = getUser(userId);
    if (!user) return null;
    const newProgress = { ...user.progress, ...progressUpdates };
    return updateUser(userId, { progress: newProgress });
  }

  function addPoints(userId, points) {
    const user = getUser(userId);
    if (!user) return null;
    const newPoints = (user.progress.points || 0) + points;
    const newLevel = calculateLevel(newPoints);
    return updateUserProgress(userId, { points: newPoints, level: newLevel });
  }

  function calculateLevel(points) {
    const levels = [0, 50, 150, 300, 500, 750, 1000];
    for (let i = levels.length - 1; i >= 0; i--) {
      if (points >= levels[i]) return i + 1;
    }
    return 1;
  }

  function hasPermission(userId, permission) {
    const user = getUser(userId);
    if (!user) return false;
    const role = ROLES[user.role];
    return role && role.permissions.includes(permission);
  }

  function linkChildToParent(parentId, childId) {
    const data = PraxiaStorage.load();
    const parent = data.users[parentId];
    const child = data.users[childId];
    
    if (!parent || !child || parent.role !== 'custos' || child.role !== 'filius') return false;
    
    if (!parent.linkedChildren.includes(childId)) {
      parent.linkedChildren.push(childId);
    }
    if (!child.linkedCustodes) child.linkedCustodes = [];
    if (!child.linkedCustodes.includes(parentId)) {
      child.linkedCustodes.push(parentId);
    }
    
    PraxiaStorage.save(data);
    return true;
  }

  return {
    ROLES,
    initializeFamily,
    createUser,
    getUser,
    getActiveUser,
    setActiveUser,
    updateUser,
    getAllUsers,
    getUsersByRole,
    getFamily,
    updateUserProgress,
    addPoints,
    calculateLevel,
    hasPermission,
    linkChildToParent
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PraxiaUsers;
}
