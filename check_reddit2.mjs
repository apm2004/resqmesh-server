const res = await fetch('https://old.reddit.com/r/ResQMesh/new.json?limit=100', {
  headers: { 'User-Agent': 'Mozilla/5.0 Chrome/122', 'Accept': 'application/json' }
});
const j = await res.json();
const posts = j?.data?.children ?? [];
// Write all titles to a simple numbered list
const lines = posts.map((c, i) => {
  const d = c.data;
  const ago = Math.floor((Date.now()/1000 - d.created_utc)/60);
  return `${String(i+1).padStart(2,'0')} | ${d.id} | ${ago}m ago | ${d.title}`;
});
// Write to file so we can read it easily
import { writeFileSync } from 'fs';
writeFileSync('reddit_list.txt', lines.join('\n'));
console.log(`Written ${lines.length} posts to reddit_list.txt`);
