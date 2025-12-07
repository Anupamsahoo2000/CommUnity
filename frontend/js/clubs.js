// js/club.js
if (window.axios) {
  axios.defaults.baseURL = "http://localhost:5000";
  axios.defaults.headers["Content-Type"] = "application/json";
}
const token = localStorage.getItem("community_token");
if (token) axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

function q(id){ return document.getElementById(id); }
function showErr(msg){ const e=q('club-error'); if(e){ e.textContent=msg; e.classList.remove('hidden'); } }
function hideErr(){ const e=q('club-error'); if(e){ e.classList.add('hidden'); e.textContent=''; } }

function getParam(name){
  const p = new URLSearchParams(window.location.search);
  return p.get(name);
}

// render helpers
function renderMemberRow(m){
  const div = document.createElement('div');
  div.className = 'flex items-center gap-3 p-2 bg-white rounded-lg border';
  div.innerHTML = `<div class="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-sm">${(m.name||'U').trim().charAt(0).toUpperCase()}</div>
    <div class="flex-1">
      <div class="text-sm font-medium">${m.name || m.email}</div>
      <div class="text-xs text-slate-500">${m.role || ''}</div>
    </div>`;
  return div;
}

function renderEventCard(e){
  const div = document.createElement('div');
  div.className = 'bg-white rounded-lg p-3 shadow-sm flex gap-3';
  div.innerHTML = `<img src="${e.bannerUrl || 'https://via.placeholder.com/120'}" class="h-16 w-24 object-cover rounded-md" />
    <div class="flex-1">
      <div class="font-semibold text-sm">${e.title}</div>
      <div class="text-xs text-slate-500">${new Date(e.startTime||Date.now()).toLocaleString()}</div>
    </div>
    <a href="event.html?id=${e.id}" class="self-center px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 text-xs">View</a>`;
  return div;
}

async function loadClub(){
  const id = getParam('id');
  if (!id) { showErr('No club id in URL'); return; }
  hideErr();
  q('club-loading').classList.remove('hidden');

  try {
    const r = await axios.get(`/clubs/${id}`);
    const club = r?.data?.club || r?.data;
    if (!club) throw new Error('Club not found');

    // populate header
    q('club-name').textContent = club.name || 'Club';
    q('club-category').textContent = club.category || '';
    q('club-members-count').textContent = `${club.memberCount ?? 0} members`;
    q('club-events-count').textContent = `${club.upcomingCount ?? 0} upcoming events`;
    q('club-visibility').textContent = club.visibility || 'Public';
    q('club-created').textContent = club.createdAt ? new Date(club.createdAt).toLocaleDateString() : '—';
    q('club-about').innerHTML = club.about || '<p class="text-sm text-slate-500">No description.</p>';

    // banner & logo
    const banner = q('club-banner'); banner.innerHTML = '';
    if (club.bannerUrl) { const img = document.createElement('img'); img.src = club.bannerUrl; img.alt = club.name; img.className='w-full h-full object-cover'; banner.appendChild(img); }
    const logo = q('club-logo'); if (club.logoUrl) { logo.innerHTML = ''; const li = document.createElement('img'); li.src = club.logoUrl; li.alt = club.name; li.className='w-full h-full object-cover rounded-xl'; logo.appendChild(li); } else { logo.textContent = (club.name||'C').trim().charAt(0).toUpperCase(); }

    // join state
    const isMember = club.isMember === true;
    q('club-join-btn').classList.toggle('hidden', isMember);
    q('club-leave-btn').classList.toggle('hidden', !isMember);
    if (club.canManage) q('club-manage-link').classList.remove('hidden');

    // events
    const eventsList = q('club-events-list');
    eventsList.innerHTML = '';
    if (Array.isArray(club.upcomingEvents) && club.upcomingEvents.length) {
      q('club-events-empty').classList.add('hidden');
      club.upcomingEvents.forEach(ev => eventsList.appendChild(renderEventCard(ev)));
    } else {
      q('club-events-empty').classList.remove('hidden');
    }

    // members
    const membersList = q('club-members-list'); membersList.innerHTML = '';
    if (Array.isArray(club.members) && club.members.length) {
      q('club-members-empty').classList.add('hidden');
      club.members.forEach(m => membersList.appendChild(renderMemberRow(m)));
    } else {
      q('club-members-empty').classList.remove('hidden');
    }

    // show card
    q('club-card').classList.remove('hidden');
    q('club-loading').classList.add('hidden');
  } catch (err) {
    console.error(err);
    showErr(err?.response?.data?.message || err.message || 'Failed to load club');
    q('club-loading').classList.add('hidden');
  }
}

// Join / Leave
async function joinClub(){
  const id = getParam('id');
  const token = localStorage.getItem('community_token');
  if (!token) { window.location.href = 'auth.html#login'; return; }
  try {
    await axios.post(`/clubs/${id}/join`, {}, { headers: { Authorization: `Bearer ${token}` }});
    await loadClub();
  } catch (err) {
    alert(err?.response?.data?.message || 'Failed to join club');
  }
}
async function leaveClub(){
  const id = getParam('id');
  const token = localStorage.getItem('community_token');
  if (!token) { window.location.href = 'auth.html#login'; return; }
  try {
    await axios.post(`/clubs/${id}/leave`, {}, { headers: { Authorization: `Bearer ${token}` }});
    await loadClub();
  } catch (err) {
    alert(err?.response?.data?.message || 'Failed to leave club');
  }
}

// Tabs
function setupTabs(){
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
      btn.classList.add('tab-active');
      const tab = btn.dataset.tab;
      ['about','events','members','chat'].forEach(t => q('tab-'+t).classList.toggle('hidden', t !== tab));
    });
  });
}

// Chat (very simple — posts to /api/clubs/:id/chat)
function setupChat(){
  const send = q('club-chat-send'); const input = q('club-chat-input'); const box = q('club-chat-messages');
  send?.addEventListener('click', async () => {
    const text = input.value.trim(); if(!text) return;
    const id = getParam('id');
    try {
      // optimistic
      const me = JSON.parse(localStorage.getItem('community_user') || '{}');
      const msg = { senderName: me.name || me.email || 'You', text, createdAt: Date.now() };
      const el = document.createElement('div'); el.className='mb-2 text-sm'; el.innerHTML = `<div class="text-xs text-slate-500">${msg.senderName}</div><div>${msg.text}</div>`;
      box.appendChild(el); box.scrollTop = box.scrollHeight;
      input.value = '';
      await axios.post(`/api/clubs/${id}/chat`, { text }, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    } catch (err) {
      alert('Failed to send chat');
    }
  });
}

// init
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupChat();
  // wire join/leave
  q('club-join-btn')?.addEventListener('click', joinClub);
  q('club-leave-btn')?.addEventListener('click', leaveClub);
  loadClub();
});
