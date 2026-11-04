const assert = require('assert');

// Simple JS mirror of the functions to test logic directly
function normalizeCategories(categories) {
  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  sorted.forEach((cat, index) => { cat.sort_order = index + 1; });
  return sorted;
}

function insertCategory(categories, newCategory, targetSortOrder) {
  const normalized = normalizeCategories(categories);
  const total = normalized.length;
  let insertIndex;
  if (!targetSortOrder || targetSortOrder > total + 1) {
    insertIndex = total;
  } else if (targetSortOrder < 1) {
    insertIndex = 0;
  } else {
    insertIndex = targetSortOrder - 1;
  }
  normalized.splice(insertIndex, 0, newCategory);
  normalized.forEach((cat, index) => { cat.sort_order = index + 1; });
  return normalized;
}

function moveCategory(categories, id, newSortOrder) {
  const normalized = normalizeCategories(categories);
  const currentIndex = normalized.findIndex((c) => c.id === id);
  if (currentIndex === -1) return normalized;
  const [targetCategory] = normalized.splice(currentIndex, 1);
  const totalAfterRemoval = normalized.length;
  let targetIndex;
  if (newSortOrder < 1) {
    targetIndex = 0;
  } else if (newSortOrder > totalAfterRemoval + 1) {
    targetIndex = totalAfterRemoval;
  } else {
    targetIndex = newSortOrder - 1;
  }
  normalized.splice(targetIndex, 0, targetCategory);
  normalized.forEach((cat, index) => { cat.sort_order = index + 1; });
  return normalized;
}

function removeCategory(categories, id) {
  const filtered = categories.filter((c) => c.id !== id);
  return normalizeCategories(filtered);
}

// ── Scenario 1: Add category at position 4 ──
let cats = [
  { id: '1', name: 'CHICKEN SOUPS', sort_order: 1 },
  { id: '2', name: 'VEG SOUPS', sort_order: 2 },
  { id: '3', name: 'CHICKEN STARTERS', sort_order: 3 },
  { id: '4', name: 'VEG STARTER', sort_order: 4 },
  { id: '5', name: 'TANDOORI CHICKEN STARTER', sort_order: 5 },
  { id: '6', name: 'HINDUSTAN PLATERS', sort_order: 6 },
];

let res1 = insertCategory(cats, { id: 'new', name: 'NEW CATEGORY' }, 4);
console.log('Test 1 (Insert at 4):');
res1.forEach(c => console.log(`  ${c.sort_order}. ${c.name}`));
assert.strictEqual(res1.find(c => c.name === 'NEW CATEGORY').sort_order, 4);
assert.strictEqual(res1.find(c => c.name === 'VEG STARTER').sort_order, 5);
assert.strictEqual(res1.find(c => c.name === 'HINDUSTAN PLATERS').sort_order, 7);
console.log('✓ Test 1 passed!');

// ── Scenario 2: Move category 6 to position 2 ──
let res2 = moveCategory(cats, '6', 2);
console.log('\nTest 2 (Move 6 to 2):');
res2.forEach(c => console.log(`  ${c.sort_order}. ${c.name}`));
assert.strictEqual(res2.find(c => c.name === 'HINDUSTAN PLATERS').sort_order, 2);
assert.strictEqual(res2.find(c => c.name === 'VEG SOUPS').sort_order, 3);
assert.strictEqual(res2.find(c => c.name === 'TANDOORI CHICKEN STARTER').sort_order, 6);
console.log('✓ Test 2 passed!');

// ── Scenario 3: Delete category and close gap ──
let res3 = removeCategory(cats, '3');
console.log('\nTest 3 (Delete position 3):');
res3.forEach(c => console.log(`  ${c.sort_order}. ${c.name}`));
assert.strictEqual(res3.length, 5);
assert.strictEqual(res3[2].name, 'VEG STARTER');
assert.strictEqual(res3[2].sort_order, 3);
assert.strictEqual(res3[4].sort_order, 5);
console.log('✓ Test 3 passed!');

