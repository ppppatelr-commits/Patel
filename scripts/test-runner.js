const assert = require('assert');

// Test suite for sort-utils
const {
  normalizeCategories,
  insertCategory,
  moveCategory,
  removeCategory,
  reorderCategories,
  normalizeItems,
  insertItem,
  moveItem,
  removeItem,
  reorderCategoryItems,
} = require('../src/lib/sort-utils.ts');

