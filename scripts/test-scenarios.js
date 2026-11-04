const assert = require('assert');

const BASE = 'http://localhost:3000';

async function runTests() {
  console.log('--- STARTING 9 SCENARIO TESTS ---\n');

  // Helper fetchers
  async function getCategories() {
    const res = await fetch(`${BASE}/api/categories`);
    return await res.json();
  }

  async function getItems(catId) {
    const url = catId ? `${BASE}/api/items?category_id=${catId}` : `${BASE}/api/items`;
    const res = await fetch(url);
    return await res.json();
  }

  async function getMenu() {
    const res = await fetch(`${BASE}/api/menu`);
    return await res.json();
  }

  // Initial State Check
  const initCats = await getCategories();
  const initItems = await getItems();
  console.log(`Initial: ${initCats.length} categories, ${initItems.length} items`);
  assert.strictEqual(initCats.length, 33);
  assert.strictEqual(initItems.length, 304);

  // ── Scenario 1: Add a category at Sort Order 4 ──
  console.log('\n[Scenario 1 & 2] Adding category "SPECIAL SIZZLERS" at Sort Order = 4...');
  const cat4Before = initCats.find(c => c.sort_order === 4);
  console.log(`  Existing category at pos 4 before insert: ${cat4Before.name}`);

  const createRes = await fetch(`${BASE}/api/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'SPECIAL SIZZLERS',
      sort_order: 4
    })
  });
  const createdCat = await createRes.json();
  assert.strictEqual(createdCat.name, 'SPECIAL SIZZLERS');
  assert.strictEqual(createdCat.sort_order, 4);

  // ── Scenario 2: Verify that all subsequent categories shift down automatically ──
  const catsAfterAdd = await getCategories();
  console.log('  Categories around position 4 after add:');
  catsAfterAdd.slice(2, 7).forEach(c => console.log(`    ${c.sort_order}. ${c.name}`));

  assert.strictEqual(catsAfterAdd.find(c => c.id === createdCat.id).sort_order, 4);
  const shiftedOld4 = catsAfterAdd.find(c => c.id === cat4Before.id);
  assert.strictEqual(shiftedOld4.sort_order, 5, 'Previous category 4 should shift to 5');
  
  // Verify sequential contiguous 1..N
  catsAfterAdd.forEach((c, idx) => {
    assert.strictEqual(c.sort_order, idx + 1, `Category at index ${idx} must have sort_order ${idx + 1}`);
  });
  console.log('✓ Scenario 1 & 2 PASSED: Category inserted at 4, subsequent categories shifted down, continuous 1..N verified!');

  // ── Scenario 3: Move an existing category from position 6 to position 2 ──
  console.log('\n[Scenario 3] Moving category at position 6 to position 2...');
  const cat6Before = catsAfterAdd.find(c => c.sort_order === 6);
  console.log(`  Category currently at pos 6: ${cat6Before.name}`);

  const moveRes = await fetch(`${BASE}/api/categories`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: cat6Before.id,
      sort_order: 2
    })
  });
  assert(moveRes.ok);

  const catsAfterMove = await getCategories();
  console.log('  Categories after moving position 6 to 2:');
  catsAfterMove.slice(0, 7).forEach(c => console.log(`    ${c.sort_order}. ${c.name}`));

  assert.strictEqual(catsAfterMove.find(c => c.id === cat6Before.id).sort_order, 2);
  catsAfterMove.forEach((c, idx) => {
    assert.strictEqual(c.sort_order, idx + 1, `Must remain continuous 1..N without duplicates`);
  });
  console.log('✓ Scenario 3 PASSED: Category moved from 6 to 2, all categories adjusted sequentially!');

  // ── Scenario 4: Delete a category and verify sequential ordering ──
  console.log('\n[Scenario 4] Deleting the added category...');
  const delRes = await fetch(`${BASE}/api/categories?id=${encodeURIComponent(createdCat.id)}`, {
    method: 'DELETE'
  });
  assert(delRes.ok);

  const catsAfterDel = await getCategories();
  console.log(`  Categories count after delete: ${catsAfterDel.length}`);
  assert.strictEqual(catsAfterDel.length, 33);
  catsAfterDel.forEach((c, idx) => {
    assert.strictEqual(c.sort_order, idx + 1, `Gap must be closed: continuous 1..33`);
  });
  console.log('✓ Scenario 4 PASSED: Category deleted, gap closed, all remaining categories renumbered sequentially!');

  // Put category order back to original order via batch reorder
  const restoreRes = await fetch(`${BASE}/api/categories`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reorder: initCats.map(c => ({ id: c.id, sort_order: c.sort_order }))
    })
  });
  assert(restoreRes.ok);

  // ── Scenario 5: Drag a menu item from position 5 to position 1 ──
  console.log('\n[Scenario 5] Reordering menu items within CHICKEN SOUPS (moving item at pos 5 to pos 1)...');
  const catSoups = (await getCategories())[0];
  const soupItems = await getItems(catSoups.id);
  console.log('  Original CHICKEN SOUPS items:');
  soupItems.forEach(i => console.log(`    ${i.sort_order}. ${i.name}`));

  const itemToMove = soupItems[4]; // pos 5: CHI LUNG FUNG SOUP
  console.log(`  Item to move: ${itemToMove.name} (from pos 5 to pos 1)`);

  const reorderedSoupList = [itemToMove, ...soupItems.filter(i => i.id !== itemToMove.id)];
  const itemReorderRes = await fetch(`${BASE}/api/items`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category_id: catSoups.id,
      reorder: reorderedSoupList.map((item, idx) => ({ id: item.id, sort_order: idx + 1 }))
    })
  });
  assert(itemReorderRes.ok);

  // ── Scenario 6: Refresh the page and verify the saved order ──
  console.log('\n[Scenario 6] Verifying saved item order from fresh API fetch...');
  const freshSoupItems = await getItems(catSoups.id);
  console.log('  Updated CHICKEN SOUPS items after save:');
  freshSoupItems.forEach(i => console.log(`    ${i.sort_order}. ${i.name}`));

  assert.strictEqual(freshSoupItems[0].id, itemToMove.id, 'Item must be at position 1');
  assert.strictEqual(freshSoupItems[0].sort_order, 1);
  freshSoupItems.forEach((i, idx) => {
    assert.strictEqual(i.sort_order, idx + 1, `Item sort_order must be continuous ${idx + 1}`);
  });
  console.log('✓ Scenario 5 & 6 PASSED: Item moved to position 1, order saved and verified!');

  // ── Scenario 7: Change the selected category and verify independent item ordering ──
  console.log('\n[Scenario 7] Checking second category (VEG SOUPS) for independent ordering...');
  const catVegSoups = (await getCategories())[1];
  const vegSoupItems = await getItems(catVegSoups.id);
  console.log('  VEG SOUPS items:');
  vegSoupItems.forEach(i => console.log(`    ${i.sort_order}. ${i.name}`));

  assert.strictEqual(vegSoupItems[0].sort_order, 1, 'VEG SOUPS starts at 1 independently');
  vegSoupItems.forEach((i, idx) => {
    assert.strictEqual(i.sort_order, idx + 1);
  });
  console.log('✓ Scenario 7 PASSED: Second category has completely independent 1..M ordering!');

  // ── Scenario 8: Verify that all 304 existing menu items remain intact ──
  console.log('\n[Scenario 8] Verifying total dish count across entire menu...');
  const allItemsNow = await getItems();
  assert.strictEqual(allItemsNow.length, 304, 'All 304 dishes must remain intact');
  console.log(`✓ Scenario 8 PASSED: Exactly ${allItemsNow.length} menu items intact!`);

  // ── Scenario 9: Verify customer-facing menu displays the same updated order ──
  console.log('\n[Scenario 9] Verifying customer menu API (/api/menu)...');
  const publicMenu = await getMenu();
  const publicSoupItems = publicMenu.items
    .filter(i => i.category_id === catSoups.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  console.log('  Public menu CHICKEN SOUPS order:');
  publicSoupItems.forEach(i => console.log(`    ${i.sort_order}. ${i.name}`));
  assert.strictEqual(publicSoupItems[0].id, itemToMove.id, 'Customer menu must reflect position 1');
  console.log('✓ Scenario 9 PASSED: Customer-facing menu matches the updated sort order!');

  // Restore original soup order
  console.log('\nRestoring original soup order...');
  await fetch(`${BASE}/api/items`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category_id: catSoups.id,
      reorder: soupItems.map((item, idx) => ({ id: item.id, sort_order: idx + 1 }))
    })
  });
  const restoredSoups = await getItems(catSoups.id);
  assert.strictEqual(restoredSoups[0].name, 'CHI HOT AND SOUR SOUP');

  console.log('\n========================================');
  console.log('🎉 ALL 9 TEST SCENARIOS PASSED WITH 100% SUCCESS!');
  console.log('========================================');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});

