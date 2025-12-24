/**
 * Praxia Storage Module
 * Handles all data persistence with localStorage
 * Features: In-memory caching, dirty-flag invalidation, backend-ready abstraction
 */

const PraxiaStorage = (function() {
  'use strict';

  const STORAGE_KEY = 'praxia_v2';
  
  // In-memory cache for performance
  let cache = null;
  let isDirty = false;
  let saveTimeout = null;
  const DEBOUNCE_MS = 500;
  
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
    curriculumProgress: {
      currentWeek: 1,
      completedLessons: []
    },
    settings: {
      theme: 'dark',
      soundEnabled: true,
      notificationsEnabled: true,
      praxisDuration: 900,
      onboardingComplete: {
        custos: false,
        filius: false
      }
    }
  };

  /**
   * Load all data from storage (with caching)
   */
  function load() {
    if (cache && !isDirty) {
      return cache;
    }
    
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        cache = { ...DEFAULT_DATA, ...parsed };
      } else {
        cache = structuredClone(DEFAULT_DATA);
      }
    } catch (e) {
      console.error('[Storage] Load error:', e);
      cache = structuredClone(DEFAULT_DATA);
    }
    
    isDirty = false;
    return cache;
  }

  /**
   * Save all data to storage (debounced)
   */
  function save(data) {
    cache = data;
    isDirty = true;
    
    // Debounce saves to prevent thrashing
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(() => {
      persistToStorage(data);
    }, DEBOUNCE_MS);
    
    return true;
  }
  
  /**
   * Immediate save (bypasses debounce)
   */
  function saveImmediate(data) {
    cache = data;
    return persistToStorage(data);
  }
  
  /**
   * Actual localStorage write
   */
  function persistToStorage(data) {
    try {
      data.lastModified = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      isDirty = false;
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
   * Get all items from an array key
   */
  function getAll(key) {
    const data = load();
    return data[key] || [];
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
   * Remove an item from an array by id (or remove a key entirely)
   */
  function remove(key, id) {
    const data = load();
    
    // If no id provided, remove the entire key
    if (id === undefined) {
      delete data[key];
      save(data);
      return true;
    }
    
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
    
    if (!Array.isArray(items)) {
      return [];
    }
    
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
   * Generate unique ID
   */
  function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all data
   */
  function clear() {
    cache = null;
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
      cache = data;
      return saveImmediate(data);
    } catch (e) {
      console.error('[Storage] Import error:', e);
      return false;
    }
  }
  
  /**
   * Invalidate cache (force reload from localStorage)
   */
  function invalidateCache() {
    cache = null;
    isDirty = true;
  }
  
  /**
   * Flush pending saves immediately
   */
  function flush() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    if (cache) {
      return persistToStorage(cache);
    }
    return true;
  }

  // Public API
  return {
    load,
    save,
    saveImmediate,
    get,
    set,
    getAll,
    append,
    update,
    remove,
    query,
    generateId,
    clear,
    clearKey,
    exportData,
    importData,
    invalidateCache,
    flush
  };
})();

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => PraxiaStorage.flush());
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PraxiaStorage;
}
