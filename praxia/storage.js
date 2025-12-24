/**
 * Praxia Storage Module
 * Handles all data persistence with localStorage
 * Backend-ready abstraction layer
 */

const PraxiaStorage = (function() {
  'use strict';

  const STORAGE_KEY = 'praxia_v2';
  
  const DEFAULT_DATA = {
    version: '2.0.0',
    family: null,
    users: {},
    activeUserId: null,
    sessions: [],
    episodes: [],
    statusCheckins: [],
    moodCheckins: [],
    respiroCompletions: [],
    assignments: [],
    achievements: [],
    settings: {
      theme: 'dark',
      soundEnabled: true,
      notificationsEnabled: true
    }
  };

  /**
   * Load all data from storage
   */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_DATA, ...parsed };
      }
    } catch (e) {
      console.error('[Storage] Load error:', e);
    }
    return structuredClone(DEFAULT_DATA);
  }

  /**
   * Save all data to storage
   */
  function save(data) {
    try {
      data.lastModified = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('[Storage] Save error:', e);
      return false;
    }
  }

  /**
   * Get a specific key from storage
   */
  function get(key) {
    const data = load();
    return data[key];
  }

  /**
   * Set a specific key in storage
   */
  function set(key, value) {
    const data = load();
    data[key] = value;
    return save(data);
  }

  /**
   * Append to an array in storage
   */
  function append(key, item) {
    const data = load();
    if (!Array.isArray(data[key])) {
      data[key] = [];
    }
    item.id = item.id || generateId();
    item.createdAt = item.createdAt || new Date().toISOString();
    data[key].push(item);
    save(data);
    return item;
  }

  /**
   * Update an item in an array by id
   */
  function update(key, id, updates) {
    const data = load();
    if (!Array.isArray(data[key])) return null;
    
    const index = data[key].findIndex(item => item.id === id);
    if (index === -1) return null;
    
    data[key][index] = { ...data[key][index], ...updates, updatedAt: new Date().toISOString() };
    save(data);
    return data[key][index];
  }

  /**
   * Remove an item from an array by id
   */
  function remove(key, id) {
    const data = load();
    if (!Array.isArray(data[key])) return false;
    
    const index = data[key].findIndex(item => item.id === id);
    if (index === -1) return false;
    
    data[key].splice(index, 1);
    save(data);
    return true;
  }

  /**
   * Query items with filters
   */
  function query(key, filters = {}) {
    const data = load();
    let items = data[key] || [];
    
    if (filters.userId) {
      items = items.filter(i => i.userId === filters.userId);
    }
    if (filters.after) {
      const afterDate = new Date(filters.after);
      items = items.filter(i => new Date(i.createdAt || i.date) >= afterDate);
    }
    if (filters.before) {
      const beforeDate = new Date(filters.before);
      items = items.filter(i => new Date(i.createdAt || i.date) <= beforeDate);
    }
    if (filters.limit) {
      items = items.slice(-filters.limit);
    }
    
    return items;
  }

  /**
   * Get all items from an array key
   */
  function getAll(key) {
    const data = load();
    return data[key] || [];
  }

  /**
   * Generate unique ID
   */
  function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all data (with confirmation)
   */
  function clear() {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  }

  /**
   * Clear a specific key (reset array to empty)
   */
  function clearKey(key) {
    const data = load();
    if (Array.isArray(data[key])) {
      data[key] = [];
    } else {
      delete data[key];
    }
    return save(data);
  }

  /**
   * Export data for backup
   */
  function exportData() {
    const data = load();
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import data from backup
   */
  function importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      save(data);
      return true;
    } catch (e) {
      console.error('[Storage] Import error:', e);
      return false;
    }
  }

  // Public API
  return {
    load,
    save,
    get,
    set,
    append,
    update,
    remove,
    query,
    getAll,
    generateId,
    clear,
    clearKey,
    exportData,
    importData
  };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PraxiaStorage;
}
