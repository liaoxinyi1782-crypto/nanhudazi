const DEMO_POSTS_KEY = 'nanhu-demo-posts-v1';
const categories = ['餐饮', '出行', '学习', '运动', '团购', '借物', '闲置'];
const categoryEmoji = {餐饮:'🍜',出行:'🚌',学习:'📚',运动:'🏸',团购:'🛍️',借物:'🤝',闲置:'🪴'};
const initialPosts = [
  {category:'餐饮',title:'中午中心食堂拼个饭，想吃石锅拌饭',note:'12:10 左右出发，吃完可以一起去图书馆占座～',place:'南湖校区 · 中心食堂',time:'8 分钟前',owner:'柚子同学',contact:'微信：youzi_demo（示例）',emoji:'🍊',joined:2,total:4},
  {category:'出行',title:'下午去光谷方向，求顺路拼车',note:'大概 17:30 出发，可在南湖校门附近上车。',place:'南湖校区 · 南门',time:'21 分钟前',owner:'小周',contact:'QQ：zhou_demo（示例）',emoji:'🚲',joined:1,total:3},
  {category:'学习',title:'图书馆三楼自习搭子，备考法考',note:'安静学习为主，中间休息时可以互相打气。',place:'南湖校区 · 图书馆',time:'36 分钟前',owner:'Mia',contact:'微信：mia_demo（示例）',emoji:'📚',joined:3,total:4},
  {category:'闲置',title:'毕业季闲置教材互换，有民法和英语',note:'书况都不错，想交换或低价带走都可以聊。',place:'南湖校区 · 南门',time:'1 小时前',owner:'阿哲',contact:'校内私信：阿哲（示例）',emoji:'🌱',joined:1,total:2},
  {category:'餐饮',title:'晚上南湖夜市一起逛，想吃烤苕皮',note:'19:00 左右，边走边吃，不赶时间。',place:'南湖校区 · 南门',time:'1 小时前',owner:'小林',contact:'微信：lin_demo（示例）',emoji:'🍡',joined:2,total:5},
  {category:'学习',title:'周末找人一起练习英语口语',note:'想聊日常话题，每人轮流准备一个主题。',place:'首义校区 · 图书馆',time:'2 小时前',owner:'L同学',contact:'邮箱：l_demo@example.com（示例）',emoji:'☕',joined:1,total:2},
  {category:'运动',title:'今晚篮球场缺两位球友',note:'友谊赛为主，新手也欢迎，带好水就行。',place:'南湖校区 · 体育馆',time:'2 小时前',owner:'阿凯',contact:'微信：kai_demo（示例）',emoji:'🏀',joined:2,total:4},
  {category:'团购',title:'宿舍一起拼纸巾和洗衣液',note:'凑够 4 份下单，校内自提，价格和规格可一起商量。',place:'南湖校区 · 中心食堂',time:'3 小时前',owner:'小陈',contact:'QQ：chen_demo（示例）',emoji:'🛍️',joined:2,total:4},
  {category:'借物',title:'周末求借一个便携投影仪',note:'借用一天，会妥善保管并按时归还。',place:'南湖校区 · 图书馆',time:'3 小时前',owner:'小许',contact:'校内私信：小许（示例）',emoji:'🤝',joined:1,total:2}
];

const config = window.NANHU_SUPABASE || {};
const supabaseUrl = String(config.url || '').replace(/\/$/, '');
const supabaseAnonKey = String(config.anonKey || '');
const cloudMode = /^https:\/\//.test(supabaseUrl) && supabaseAnonKey.length > 10;
let active = '全部';
let posts = [];
let currentUser = null;
let student = '';
const cards = document.getElementById('cards');
const gate = document.getElementById('gate');

function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }
function saveDemoPosts() { try { localStorage.setItem(DEMO_POSTS_KEY, JSON.stringify(posts.filter(p => p.mine))); } catch { toast('浏览器未能保存，请检查存储空间或隐私设置'); } }
function escapeHtml(s = '') { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function timeLabel(date) { const minutes = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 60000)); return minutes < 60 ? `${minutes} 分钟前` : minutes < 1440 ? `${Math.floor(minutes/60)} 小时前` : `${Math.floor(minutes/1440)} 天前`; }
function toast(msg) { const el = document.getElementById('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => el.hidden = true, 2600); }

function setFilter(filter) {
  active = filter;
  document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
  render();
}
function showView(view) {
  const isMine = view === 'mine';
  document.getElementById('feedView').hidden = isMine;
  document.getElementById('mineView').hidden = !isMine;
  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.toggle('active', b.id === 'myPosts' ? isMine : b.dataset.filter === '全部' && !isMine));
  if (isMine) render(); else window.scrollTo({top:0,behavior:'smooth'});
}
function postCard(p, canJoin = true) {
  const id = p.id || String(posts.indexOf(p));
  return `<article class="card"><div class="card-top"><span class="category">${escapeHtml(p.category)}</span><span class="time">${escapeHtml(p.time)}</span></div><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.note)}</p><div class="meta"><span>📍 ${escapeHtml(p.place)}</span><span class="people">👥 ${p.joined}/${p.total} 人</span></div>${!canJoin ? `<div class="meta"><span>联系：${escapeHtml(p.contact || '点击报名后可查看')}</span></div>` : ''}<div class="card-foot"><span class="owner"><span class="mini-avatar">${escapeHtml(p.emoji || '🙂')}</span>${escapeHtml(p.owner)}</span>${canJoin ? `<button class="join" data-join="${escapeHtml(id)}">${p.joined >= p.total ? '已满员' : '我也想参加'}</button>` : `<span class="category">我发起的</span>`}</div></article>`;
}
function render() {
  const q = document.getElementById('search').value.trim().toLowerCase();
  const rows = posts.filter(p => (active === '全部' || p.category === active) && (!q || `${p.title} ${p.note} ${p.place} ${p.category}`.toLowerCase().includes(q)));
  cards.innerHTML = rows.length ? rows.map(p => postCard(p)).join('') : '<div class="empty">还没有找到相关拼单，试试换个关键词吧～</div>';
  document.getElementById('countLabel').textContent = `共 ${rows.length} 个校园新鲜事`;
  const mine = posts.filter(p => p.mine);
  document.getElementById('mineCards').innerHTML = mine.length ? mine.map(p => postCard(p, false)).join('') : '<div class="empty">你还没有发起拼单，去广场找找灵感吧～</div>';
  document.getElementById('mineCount').textContent = `${mine.length} 条`;
}

function showAuthGate() { gate.hidden = false; document.getElementById('cloudLogin').hidden = !cloudMode; document.getElementById('demoLogin').hidden = cloudMode; }
function showLoggedIn() {
  gate.hidden = true;
  const label = cloudMode ? `同学 ****${currentUser.username.slice(-4)}` : `同学 ${student.slice(-2)}`;
  document.getElementById('userLabel').textContent = label;
  render();
}

function apiHeaders() { return {'apikey':supabaseAnonKey,'Content-Type':'application/json'}; }
async function api(path, options = {}) {
  const request = {method:options.method || 'GET',headers:{...apiHeaders(),...(options.headers || {}),...(options.prefer ? {'Prefer':options.prefer} : {})},body:options.body ? JSON.stringify(options.body) : undefined};
  let response;
  try {
    response = await fetch(`${supabaseUrl}/rest/v1/${path}`, request);
  } catch (firstError) {
    if (navigator.onLine === false) throw new Error('当前设备未连接网络，请检查网络后重试。');
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      response = await fetch(`${supabaseUrl}/rest/v1/${path}`, request);
    } catch {
      throw new Error('无法连接共享数据库。请检查网络，或尝试用 Safari/Chrome 打开；部分网络可能无法稳定访问数据库服务。');
    }
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || data?.hint || data?.details || `数据库请求失败（${response.status}）`);
  return data;
}
async function loadCloudPosts() {
  const fields = 'id,owner_tag,category,title,note,campus,place,target_count,current_count,created_at';
  const rows = await api(`posts?select=${fields}&order=created_at.desc`);
  const mineRows = await api('rpc/my_posts',{method:'POST',body:{p_username:currentUser.username}});
  const mineIds = new Set(mineRows.map(row => row.id));
  const myContacts = new Map(mineRows.map(row => [row.id,row.contact]));
  posts = rows.map(row => ({id:row.id,owner:row.owner_tag,category:row.category,title:row.title,note:row.note,place:`${row.campus} · ${row.place}`,time:timeLabel(row.created_at),emoji:categoryEmoji[row.category] || '🙂',joined:row.current_count,total:row.target_count,mine:mineIds.has(row.id),contact:myContacts.get(row.id) || ''}));
  render();
}
async function enterShared(username) {
  const error = document.getElementById('cloudError');
  if (!/^20\d{10}$/.test(username)) { error.textContent='请输入 20 开头的 12 位学号'; return; }
  error.textContent='';
  currentUser={username};
  const button=document.getElementById('cloudEnter'); button.disabled=true; button.textContent='正在连接共享广场…';
  try { await loadCloudPosts(); showLoggedIn(); }
  catch (e) { currentUser=null; error.textContent=`连接失败：${e.message}`; }
  finally { button.disabled=false; button.textContent='进入共享广场'; }
}

const modal = document.getElementById('createModal');
function openModal() { modal.hidden = false; }
function closeModal() { modal.hidden = true; }
const contactModal = document.getElementById('contactModal');
function showContact(p) { document.getElementById('contactEmoji').textContent = p.emoji || '🙂'; document.getElementById('contactOwner').textContent = p.owner || '发起人'; document.getElementById('contactValue').textContent = p.contact || '发起人暂未填写联系方式'; contactModal.hidden = false; }
function hideContact() { contactModal.hidden = true; }

document.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => setFilter(b.dataset.filter)));
document.getElementById('search').addEventListener('input', render);
document.getElementById('enterBtn').onclick = () => {
  const val = document.getElementById('studentId').value.trim();
  if (!/^20\d{10}$/.test(val)) { document.getElementById('gateError').textContent='请输入 20 开头的 12 位学号'; return; }
  student = val; showLoggedIn();
};
document.getElementById('studentId').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('enterBtn').click(); });
document.getElementById('studentId').addEventListener('input', e => { e.target.value=e.target.value.replace(/\D/g,'').slice(0,12); document.getElementById('gateError').textContent=''; });
document.getElementById('cloudEnter').onclick = () => enterShared(document.getElementById('cloudUsername').value.trim());
document.getElementById('cloudUsername').addEventListener('input', e => { e.target.value=e.target.value.replace(/\D/g,'').slice(0,12); document.getElementById('cloudError').textContent=''; });
document.getElementById('cloudUsername').addEventListener('keydown', e => { if(e.key==='Enter') enterShared(e.target.value.trim()); });
document.getElementById('createBtn').onclick = openModal;
document.getElementById('mobileCreate').onclick = openModal;
document.querySelector('[data-close]').onclick = closeModal;
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.getElementById('categoryChoices').addEventListener('click', e => { const b=e.target.closest('.choice'); if (!b) return; document.querySelectorAll('.choice').forEach(x => x.classList.toggle('selected',x===b)); });
const totalInput = document.getElementById('postTotal');
const joinedInput = document.getElementById('postJoined');
function syncPeopleFields(changed='total') { let total=Math.max(2,Math.min(30,Number(totalInput.value)||2)); totalInput.value=total; joinedInput.max=total; let joined=Math.max(1,Math.min(total,Number(joinedInput.value)||1)); if(changed==='total'&&Number(joinedInput.value)>total) joined=total; joinedInput.value=joined; }
totalInput.addEventListener('input', () => syncPeopleFields('total'));
joinedInput.addEventListener('input', () => syncPeopleFields('joined'));

cards.addEventListener('click', async e => {
  const button = e.target.closest('[data-join]'); if (!button) return;
  const p = cloudMode ? posts.find(item => item.id === button.dataset.join) : posts[Number(button.dataset.join)];
  if (!p || p.joined >= p.total) { toast('这个拼单已经满员啦'); return; }
  if (cloudMode) {
    try {
      const result = await api('rpc/join_post',{method:'POST',body:{p_post_id:p.id,p_username:currentUser.username}});
      if (result.full) { p.joined=result.current_count; render(); toast('这个拼单已经满员啦'); return; }
      p.joined=result.current_count; p.contact=result.contact; render(); showContact(p);
    } catch (err) { toast(`报名失败：${err.message}`); }
  } else { p.joined++; saveDemoPosts(); render(); showContact(p); }
});
document.getElementById('contactClose').onclick = hideContact;
document.getElementById('backToSquare').onclick = hideContact;
contactModal.addEventListener('click', e => { if (e.target === contactModal) hideContact(); });

document.getElementById('publishBtn').onclick = async () => {
  const title=document.getElementById('postTitle').value.trim();
  if (!title) { toast('先写一句想找什么搭子吧'); return; }
  syncPeopleFields();
  const total=Number(totalInput.value), joined=Number(joinedInput.value);
  const category=document.querySelector('.choice.selected').dataset.value;
  const campus=document.getElementById('postCampus').value.trim()||'校区待确认';
  const place=document.getElementById('postPlace').value.trim()||'地点待确认';
  const contact=document.getElementById('postContact').value.trim();
  if (!contact) { toast('请填写一种联系方式'); return; }
  const note=document.getElementById('postNote').value.trim()||'期待和你一起～';
  const publishButton=document.getElementById('publishBtn'); publishButton.disabled=true;
  try {
    if (cloudMode) {
      await api('rpc/create_post',{method:'POST',body:{p_username:currentUser.username,p_category:category,p_title:title,p_note:note,p_campus:campus,p_place:place,p_target_count:total,p_current_count:joined,p_contact:contact}});
      await loadCloudPosts();
    } else {
      posts.unshift({category,title,note,place:`${campus} · ${place}`,contact,time:'刚刚',owner:'我',emoji:'🙂',joined,total,mine:true}); saveDemoPosts(); render();
    }
    ['postTitle','postNote','postCampus','postPlace','postContact'].forEach(id => document.getElementById(id).value='');
    totalInput.value=4; joinedInput.value=1; joinedInput.max=4; closeModal(); setFilter('全部'); showView('mine');
    toast(cloudMode?'已发布到共享广场':'演示内容已保存在本机浏览器');
  } catch (err) { toast(`发布失败：${err.message}`); }
  finally { publishButton.disabled=false; }
};
document.getElementById('myPosts').onclick = () => showView('mine');
document.querySelector('.bottom-nav [data-filter="全部"]').onclick = () => showView('feed');
document.getElementById('campusButton').onclick = () => toast('校区筛选：南湖校区 / 首义校区');
document.getElementById('userLabel').parentElement.addEventListener('click', async () => {
  if (!cloudMode || !currentUser) return;
  currentUser=null; posts=[]; render(); showAuthGate(); toast('已退出共享广场');
});

if (cloudMode) {
  document.getElementById('publishNotice').textContent='发布内容会保存到共享数据库；所有访客可见拼单，联系方式在参加后显示。用户名可被冒用。';
  document.getElementById('mineNotice').textContent='此处按输入的 12 位用户名筛选；该用户名未验证，不能作为隐私保护。';
  document.getElementById('demoLogin').hidden = true;
  document.getElementById('cloudLogin').hidden = false;
  showAuthGate(); render();
} else {
  posts=[...readJson(DEMO_POSTS_KEY,[]).filter(p=>p&&p.mine),...initialPosts];
  document.getElementById('publishNotice').textContent='演示版只保存在当前浏览器；配置 Supabase 后才会跨设备共享。';
  document.getElementById('mineNotice').textContent='演示版只保存当前浏览器中由你发起的拼单，不会同步给其他同学。';
  showAuthGate(); render();
}
