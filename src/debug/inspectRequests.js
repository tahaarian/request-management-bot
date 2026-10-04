/**
 * One-shot diagnostic: dumps raw request list + key fields + bizId from Info.
 * Run with: node src/debug/inspectRequests.js
 */
require('dotenv').config();
const axios = require('axios');

const BASE_URL  = process.env.API_BASE_URL;
const API_TOKEN = process.env.API_TOKEN;
const TYPE      = process.env.REQUEST_LIST_TYPE || 1;

// Field ID confirmed from FAMS site
const BIZ_ID_FIELD_ID = 27079;

const headers = { 'Token': API_TOKEN, 'Content-Type': 'application/json' };

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log(`\n=== FAMS Request Inspector ===`);
  console.log(`Base URL : ${BASE_URL}`);
  console.log(`Type     : ${TYPE}`);
  console.log(`Token    : ${API_TOKEN ? API_TOKEN.slice(0, 8) + '...' : 'MISSING'}`);
  console.log(`BizId FieldId : ${BIZ_ID_FIELD_ID}\n`);

  // ── Step 1: Get list ──────────────────────────────────────────────────────
  let listRes;
  try {
    listRes = await axios.get(`${BASE_URL}/Biz/Request/List`, {
      headers,
      params: { type: TYPE },
    });
  } catch (err) {
    console.error('❌ List API failed:', err.response?.status, err.response?.data || err.message);
    process.exit(1);
  }

  const body = listRes.data;

  if (body.HasError) {
    console.error('❌ API returned error:', body.ErrorMessage);
    process.exit(1);
  }

  const items = Array.isArray(body.Result)
    ? body.Result
    : body.Result?.items ?? body.Result?.data ?? [];

  console.log(`📋 Total items in list: ${items.length}`);

  if (!Array.isArray(items) || items.length === 0) {
    console.log('\nFull raw body:');
    console.log(JSON.stringify(body, null, 2));
    return;
  }

  // ── Step 2: Process first 10 items ────────────────────────────────────────
  const testCount = Math.min(10, items.length);
  console.log(`\n🔍 Fetching bizId for first ${testCount} requests...\n`);

  const results = [];

  for (let i = 0; i < testCount; i++) {
    const item       = items[i];
    const workItemId = item.PId ?? item.Id ?? item.id;
    const itemName   = item.Name || item.Title || '(no name)';
    const stateName  = item.StateInfo?.Name ?? item.StateName ?? '???';

    console.log(`[${i + 1}/${testCount}] Processing Id=${workItemId} "${itemName}"...`);

    try {
      const infoRes = await axios.get(`${BASE_URL}/Biz/Request/Info`, {
        headers,
        params: { workItemId },
      });

      const infoData = infoRes.data;

      if (infoData.HasError) {
        console.log(`  ❌ API error: ${infoData.ErrorMessage}`);
        results.push({ id: workItemId, name: itemName, state: stateName, bizId: null, error: infoData.ErrorMessage });
        continue;
      }

      const infoItem   = infoData.Result ?? infoData.result ?? infoData;
      const fieldsInfo = infoItem?.FieldsInfo ?? infoItem?.fieldsInfo ?? [];

      // Field structure from FAMS: { Id, Value, Type, ConstantId, Alias }
      const bizField = fieldsInfo.find(
        f => (f.Id ?? f.FieldId ?? f.fieldId) === BIZ_ID_FIELD_ID
      );
      const bizId = bizField ? (bizField.Value ?? bizField.value ?? null) : null;

      console.log(`  ✅ bizId = ${bizId ?? 'NOT FOUND'}`);
      results.push({ id: workItemId, name: itemName, state: stateName, bizId, error: null });

      if (i < testCount - 1) await delay(300);

    } catch (err) {
      const msg = err.response?.data?.ErrorMessage || err.message;
      console.log(`  ❌ Request failed: ${err.response?.status} ${msg}`);
      results.push({ id: workItemId, name: itemName, state: stateName, bizId: null, error: msg });
    }
  }

  // ── Step 3: Summary table ─────────────────────────────────────────────────
  console.log('\n\n═══════════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY TABLE');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  console.log('ID       | State       | bizId      | Name');
  console.log('---------|-------------|------------|----------------------------------');

  results.forEach(r => {
    const idStr    = String(r.id).padEnd(8);
    const stateStr = String(r.state).padEnd(11);
    const bizIdStr = r.bizId ? String(r.bizId).padEnd(10) : '(none)    ';
    const nameStr  = r.name.substring(0, 30);
    console.log(`${idStr} | ${stateStr} | ${bizIdStr} | ${nameStr}`);
  });

  const foundCount    = results.filter(r => r.bizId).length;
  const notFoundCount = results.filter(r => !r.bizId && !r.error).length;
  const errorCount    = results.filter(r => r.error).length;

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`✅ Found bizId    : ${foundCount}/${testCount}`);
  console.log(`⚠️  Missing bizId : ${notFoundCount}/${testCount}`);
  console.log(`❌ API errors     : ${errorCount}/${testCount}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  if (foundCount > 0) {
    console.log('✨ Confirmed: FieldId 27079 = bizId. Ready to update requestProcessor.js');
  } else {
    console.log('⚠️  No bizId found — verify FieldId 27079 exists in FieldsInfo responses.');
  }
}

main();
