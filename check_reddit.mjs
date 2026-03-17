const res = await fetch('https://old.reddit.com/r/ResQMesh/new.json?limit=100', {
  headers: { 'User-Agent': 'Mozilla/5.0 Chrome/122', 'Accept': 'application/json' }
});
const j = await res.json();
const posts = j?.data?.children ?? [];
console.log(`Total posts on Reddit: ${posts.length}`);
console.log('---');
for (const c of posts) {
  const d = c.data;
  const ago = Math.floor((Date.now()/1000 - d.created_utc)/60);
  console.log(`[${d.id}] ${ago}m ago | ${d.title}`);
}
