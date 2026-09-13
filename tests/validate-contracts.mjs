import fs from 'fs';
import path from 'path';

const fixturesDir = path.resolve('tests/fixtures');
const files = [
  'mock-osm.geojson',
  'mock-network.json',
  'mock-scenario.json',
  'mock-simulation-state.json',
  'mock-simulation-events.json',
  'mock-impact-result.json',
  'mock-uncertainty-result.json',
  'mock-criticality-result.json',
  'mock-optimization-result.json',
  'mock-advisor-result.json',
  'mock-interventions.json',
];

console.log('--- VALIDATING CONTRACT FIXTURES ---');
let allOk = true;

for (const f of files) {
  const filePath = path.join(fixturesDir, f);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Missing fixture: ${f}`);
    allOk = false;
    continue;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    console.log(`✅ ${f}: Valid JSON (${typeof parsed === 'object' ? Object.keys(parsed).length + ' keys' : 'array'})`);
  } catch (err) {
    console.error(`❌ ${f}: Invalid JSON - ${err.message}`);
    allOk = false;
  }
}

if (!allOk) {
  process.exit(1);
} else {
  console.log('🎉 ALL FIXTURES PASS CONTRACT CHECKS!');
}
