const fs = require('fs');

const file = 'data/library.json';
const lib = JSON.parse(fs.readFileSync(file, 'utf8'));
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date());

const before = Array.isArray(lib.schedule) ? lib.schedule.length : 0;
const kept = (lib.schedule || []).filter((e) => e && typeof e.date === 'string' && e.date >= today);
lib.schedule = kept;

if (kept.length !== before) {
  lib.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(lib));
  console.log(`Removed ${before - kept.length} expired schedule(s); today=${today}; remaining=${kept.length}`);
} else {
  console.log(`No expired schedules; today=${today}; total=${before}`);
}
