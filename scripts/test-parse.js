// Simulate what the server should do
const content = '```json\n{\n  "overview": "## test",\n  "modules": "mod",\n  "flow": "fl",\n  "replicate": "rep",\n  "cards": "[{\\"title\\":\\"t\\"}]"\n}\n```';
console.log('RAW input:');
console.log(content.substring(0, 200));

let jsonStr = content.trim();
if (jsonStr.startsWith('```')) {
  jsonStr = jsonStr.replace(/^```json?\s*/, '').replace(/```\s*$/, '');
}
console.log('\nAfter strip:');
console.log(jsonStr.substring(0, 200));

let guide;
try {
  guide = JSON.parse(jsonStr);
  if (typeof guide.overview === 'string' && guide.overview.trim().startsWith('```')) {
    guide = JSON.parse(guide.overview.replace(/^```json?\s*/, '').replace(/```\s*$/, '').trim());
  }
} catch (e) {
  console.log('Parse error:', e.message);
}
console.log('\nResult overview:', guide.overview);
console.log('modules:', guide.modules);
console.log('flow:', guide.flow);
console.log('replicate:', guide.replicate);
console.log('cards:', guide.cards);
