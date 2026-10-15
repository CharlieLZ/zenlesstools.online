import assert from 'node:assert/strict';
const [sha] = process.argv.slice(2);
assert.match(sha ?? '', /^[a-f0-9]{40}$/, 'Pass the merged Git SHA');
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const pagesToken = process.env.CLOUDFLARE_API_TOKEN;
const accessToken = process.env.CLOUDFLARE_DASHBOARD_AGENT_TOKEN;
assert(account && pagesToken && accessToken, 'Cloudflare read credentials are required');
async function api(path, token) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, {headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(15000)});
  assert.equal(response.status, 200, `Cloudflare API ${path}: HTTP ${response.status}`);
  const body = await response.json();
  assert.equal(body.success, true, `Cloudflare API ${path}: ${JSON.stringify(body.errors)}`);
  return body.result;
}
async function page(url, status) {
  const response = await fetch(url, {redirect: 'manual', signal: AbortSignal.timeout(15000)});
  assert.equal(response.status, status, `${url}: HTTP ${response.status}`);
  return response;
}
const deployments = await api('/pages/projects/zenlesstools-online/deployments?env=production&per_page=5', pagesToken);
const latest = deployments.filter(item => item.environment === 'production').sort((a,b) => b.created_on.localeCompare(a.created_on))[0];
assert(latest, 'No production Pages deployment');
assert.equal(latest.deployment_trigger?.metadata?.commit_hash, sha, 'Production Pages SHA differs');
assert.equal(latest.latest_stage?.status, 'success', 'Production Pages deployment did not succeed');
const preview = new URL(latest.url);
assert.equal(preview.hostname.split('.').slice(1).join('.'), 'zenlesstools-online.pages.dev', 'Unexpected Pages preview host');
const html = await (await page(new URL('/admin/', preview), 200)).text();
assert.match(html, /Admin overview/, 'Admin artifact missing');
assert.match(html, /noindex/, 'Admin artifact is indexable');
const policy = await api('/access/policies/eed389a5-378d-4760-9220-08e7878f6be1', accessToken);
assert.equal(policy.decision, 'allow');
assert.deepEqual(policy.include, [{email: {email: 'charlie0simmon@gmail.com'}}]);
const app = await api('/access/apps/5bdd7e76-68ba-4ea4-9207-03fa86b9e5c3', accessToken);
assert.equal(app.type, 'self_hosted');
assert.deepEqual(app.destinations.map(({type,uri}) => ({type,uri})), [
  {type: 'public', uri: 'zenlesstools.online/admin'}, {type: 'public', uri: 'www.zenlesstools.online/admin'}
]);
assert.equal(app.policies?.[0]?.id, policy.id);
await page('https://zenlesstools.online/', 200);
const health = await (await page('https://zenlesstools.online/api/health', 200)).json();
assert.equal(health.ok, true);
assert.equal(health.service, 'zenlesstools-online');
assert.equal(health.buildSha, sha, 'Production health SHA differs');
const planner = await (await page('https://zenlesstools.online/tools/pull-planner', 200)).text();
assert(planner.includes(`assets/js/main.js?v=${sha}`), 'Planner script is not bound to the release');
const script = await (await page(`https://zenlesstools.online/assets/js/main.js?v=${sha}`, 200)).text();
assert.match(script, /calculator_complete/);
assert.match(script, /Planning threshold covered/);
for (const url of ['https://zenlesstools.online/admin', 'https://zenlesstools.online/admin/', 'https://zenlesstools.online/admin/index.html', 'https://www.zenlesstools.online/admin/']) {
  const response = await page(url, 302);
  const login = new URL(response.headers.get('location') ?? '', url);
  assert.equal(login.hostname, 'charlie0simmon.cloudflareaccess.com');
  assert.match(login.pathname, /^\/cdn-cgi\/access\/login\//);
}
console.log(JSON.stringify({status: 'pass', sha, healthSha: health.buildSha, deploymentId: latest.id, previewUrl: latest.url, accessAppId: app.id, publicPaths: 4, protectedPaths: 4}));
