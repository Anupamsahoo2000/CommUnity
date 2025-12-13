// frontend/js/clubs.js
if (window.axios) {
  axios.defaults.baseURL = "http://localhost:5000";
  axios.defaults.headers["Content-Type"] = "application/json";
}
const token = localStorage.getItem("community_token");
if (token) axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

function q(id) {
  return document.getElementById(id);
}
function showErr(msg) {
  const e = q("club-error");
  if (e) {
    e.textContent = msg;
    e.classList.remove("hidden");
  }
}
function hideErr() {
  const e = q("club-error");
  if (e) {
    e.classList.add("hidden");
    e.textContent = "";
  }
}

function getParam(name) {
  const p = new URLSearchParams(window.location.search);
  return p.get(name);
}

// Debounce util
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// POST helper for AI endpoints
async function fetchAiPredictive(text) {
  try {
    const r = await axios.post("/ai/predictive", { text });
    return r?.data?.suggestions || [];
  } catch (e) {
    console.warn("AI predictive failed", e);
    return [];
  }
}
async function fetchAiSmartReplies(message) {
  try {
    const r = await axios.post("/ai/smart-replies", { message });
    return r?.data?.replies || [];
  } catch (e) {
    console.warn("AI smart replies failed", e);
    return [];
  }
}

// -------- render helpers (unchanged) ----------
function renderMemberRow(m) {
  const div = document.createElement("div");
  div.className = "flex items-center gap-3 p-2 bg-white rounded-lg border";
  div.innerHTML = `<div class="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-sm">${(
    m.name || "U"
  )
    .trim()
    .charAt(0)
    .toUpperCase()}</div>
    <div class="flex-1">
      <div class="text-sm font-medium">${m.name || m.email}</div>
      <div class="text-xs text-slate-500">${m.role || ""}</div>
    </div>`;
  return div;
}

function renderEventCard(e) {
  const div = document.createElement("div");
  div.className = "bg-white rounded-lg p-3 shadow-sm flex gap-3";
  div.innerHTML = `<img src="${
    e.bannerUrl || "https://via.placeholder.com/120"
  }" class="h-16 w-24 object-cover rounded-md" />
    <div class="flex-1">
      <div class="font-semibold text-sm">${e.title}</div>
      <div class="text-xs text-slate-500">${new Date(
        e.startTime || Date.now()
      ).toLocaleString()}</div>
    </div>
    <a href="event.html?id=${
      e.id
    }" class="self-center px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 text-xs">View</a>`;
  return div;
}

// --------- Club banner upload ----------
function setupClubBannerUpload(clubId, canManage) {
  const wrap = q("club-banner-upload-wrap");
  const input = q("club-banner-input");
  const btn = q("club-banner-upload-btn");
  const msg = q("club-banner-upload-msg");

  if (!wrap || !input || !btn) return;
  if (!canManage) return;

  wrap.classList.remove("hidden");

  btn.addEventListener("click", async () => {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const token = localStorage.getItem("community_token");
    if (!token) {
      window.location.href = "auth.html#login";
      return;
    }

    const formData = new FormData();
    formData.append("banner", file);

    btn.disabled = true;
    msg.textContent = "Uploading...";

    try {
      const resp = await axios.post(`/clubs/${clubId}/banner`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      const url = resp?.data?.bannerUrl;
      msg.textContent = "Banner updated.";

      if (url) {
        const banner = q("club-banner");
        banner.innerHTML = "";
        const img = document.createElement("img");
        img.src = url;
        img.className = "w-full h-full object-cover";
        banner.appendChild(img);
      }
    } catch (err) {
      console.error("Club banner upload failed", err);
      msg.textContent =
        err?.response?.data?.message || "Failed to upload banner.";
    } finally {
      btn.disabled = false;
    }
  });
}

// ---------- Load / populate ----------
async function loadClub() {
  const id = getParam("id");
  if (!id) {
    showErr("No club id in URL");
    return;
  }
  hideErr();
  q("club-loading").classList.remove("hidden");

  try {
    const r = await axios.get(`/clubs/${id}`);
    const club = r?.data?.club || r?.data;
    if (!club) throw new Error("Club not found");

    // populate header
    q("club-name").textContent = club.name || "Club";
    q("club-category").textContent = club.category || "";
    q("club-members-count").textContent = `${club.memberCount ?? 0} members`;
    q("club-events-count").textContent = `${
      club.upcomingCount ?? 0
    } upcoming events`;
    q("club-visibility").textContent = club.visibility || "Public";
    q("club-created").textContent = club.createdAt
      ? new Date(club.createdAt).toLocaleDateString()
      : "—";
    q("club-about").innerHTML =
      club.about || '<p class="text-sm text-slate-500">No description.</p>';

    // banner & logo
    const banner = q("club-banner");
    banner.innerHTML = "";
    if (club.bannerUrl) {
      const img = document.createElement("img");
      img.src = club.bannerUrl;
      img.alt = club.name;
      img.className = "w-full h-full object-cover";
      banner.appendChild(img);
    }
    const logo = q("club-logo");
    if (club.logoUrl) {
      logo.innerHTML = "";
      const li = document.createElement("img");
      li.src = club.logoUrl;
      li.alt = club.name;
      li.className = "w-full h-full object-cover rounded-xl";
      logo.appendChild(li);
    } else {
      logo.textContent = (club.name || "C").trim().charAt(0).toUpperCase();
    }

    // join state
    const isMember = club.isMember === true;
    if (q("club-join-btn"))
      q("club-join-btn").classList.toggle("hidden", isMember);
    if (q("club-leave-btn"))
      q("club-leave-btn").classList.toggle("hidden", !isMember);
    if (club.canManage && q("club-manage-link"))
      q("club-manage-link").classList.remove("hidden");

    setupClubBannerUpload(club.id, club.canManage === true);

    // events
    const eventsList = q("club-events-list");
    eventsList.innerHTML = "";
    if (Array.isArray(club.upcomingEvents) && club.upcomingEvents.length) {
      q("club-events-empty").classList.add("hidden");
      club.upcomingEvents.forEach((ev) =>
        eventsList.appendChild(renderEventCard(ev))
      );
    } else {
      q("club-events-empty").classList.remove("hidden");
    }

    // members
    const membersList = q("club-members-list");
    membersList.innerHTML = "";
    if (Array.isArray(club.members) && club.members.length) {
      q("club-members-empty").classList.add("hidden");
      club.members.forEach((m) => membersList.appendChild(renderMemberRow(m)));
    } else {
      q("club-members-empty").classList.remove("hidden");
    }

    // show card
    q("club-card").classList.remove("hidden");
    q("club-loading").classList.add("hidden");
  } catch (err) {
    console.error(err);
    showErr(
      err?.response?.data?.message || err.message || "Failed to load club"
    );
    q("club-loading").classList.add("hidden");
  }
}

// Join / Leave
async function joinClub() {
  const id = getParam("id");
  const token = localStorage.getItem("community_token");
  if (!token) {
    window.location.href = "auth.html#login";
    return;
  }
  try {
    await axios.post(
      `/clubs/${id}/join`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    await loadClub();
  } catch (err) {
    alert(err?.response?.data?.message || "Failed to join club");
  }
}
async function leaveClub() {
  const id = getParam("id");
  const token = localStorage.getItem("community_token");
  if (!token) {
    window.location.href = "auth.html#login";
    return;
  }
  try {
    await axios.post(
      `/clubs/${id}/leave`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    await loadClub();
  } catch (err) {
    alert(err?.response?.data?.message || "Failed to leave club");
  }
}

// Tabs
function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.remove("tab-active"));
      btn.classList.add("tab-active");
      const tab = btn.dataset.tab;
      ["about", "events", "members", "chat"].forEach((t) =>
        q("tab-" + t).classList.toggle("hidden", t !== tab)
      );
    });
  });
}

// -------- club chat ----------
let clubSocket = null;

async function loadClubChatHistory(clubId) {
  const box = q("club-chat-messages");
  if (!box) return;
  box.innerHTML = "";

  try {
    const resp = await axios.get(`/clubs/${clubId}/chat?limit=50`);
    const msgs = resp?.data?.data || [];
    msgs.forEach((msg) => appendClubChatMessage(msg));
    box.scrollTop = box.scrollHeight;
  } catch (err) {
    console.warn("Failed to load club chat history", err);
  }
}

function appendClubChatMessage(msg) {
  const box = q("club-chat-messages");
  if (!box) return;
  const el = document.createElement("div");
  el.className = "mb-2 text-sm relative";
  el.innerHTML = `
    <div class="text-xs text-slate-500">
      ${msg.senderName || "User"} · ${new Date(
    msg.createdAt || Date.now()
  ).toLocaleTimeString()}
    </div>
    <div ${
      msg.isAdminOrOwner
        ? 'class="font-medium text-primary-700"'
        : 'class="text-slate-800"'
    }>
      ${msg.text}
    </div>
  `;
  box.appendChild(el);

  // add smart reply button for messages not sent by current user
  const me = JSON.parse(localStorage.getItem("community_user") || "{}");
  if (
    (msg.senderId && String(msg.senderId) !== String(me.id)) ||
    !msg.senderId
  ) {
    addSmartReplyButtonToMessage(el, msg.text);
  }

  box.scrollTop = box.scrollHeight;
}

function setupClubChat(clubId) {
  const send = q("club-chat-send");
  const input = q("club-chat-input");
  const box = q("club-chat-messages");
  const typingEl = q("club-chat-typing");

  // socket connection
  try {
    clubSocket = io(axios.defaults.baseURL || "/", {
      transports: ["websocket"],
    });
    clubSocket.on("connect", () => {
      clubSocket.emit("join_club_room", { clubId });
    });
    clubSocket.on("chat_message", (msg) => {
      if (msg.clubId === clubId) appendClubChatMessage(msg);
    });
    clubSocket.on("typing", ({ user }) => {
      if (!typingEl) return;
      typingEl.classList.remove("hidden");
      typingEl.textContent = `${user} is typing...`;
      setTimeout(() => typingEl.classList.add("hidden"), 1200);
    });
  } catch (err) {
    console.warn("Club socket connect failed", err);
  }

  send?.addEventListener("click", async () => {
    const text = input.value.trim();
    if (!text) return;
    const token = localStorage.getItem("community_token");
    if (!token) {
      window.location.href = "auth.html#login";
      return;
    }

    // optimistic message
    const me = JSON.parse(localStorage.getItem("community_user") || "{}");
    appendClubChatMessage({
      senderName: me.name || me.email || "You",
      text,
      createdAt: Date.now(),
      isAdminOrOwner: me.role === "HOST" || me.role === "ADMIN",
      clubId,
      senderId: me.id,
    });
    box.scrollTop = box.scrollHeight;
    input.value = "";

    try {
      await axios.post(
        `/clubs/${clubId}/chat`,
        { text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      alert("Failed to send chat message");
      console.error(err);
    }
  });

  // typing indicator emit
  input?.addEventListener("input", () => {
    if (clubSocket && clubSocket.connected) {
      clubSocket.emit("typing", {
        clubId,
        user:
          JSON.parse(localStorage.getItem("community_user") || "{}").name ||
          "Someone",
      });
    }
  });

  // attach predictive typing on this input
  attachPredictiveTypingToChatClub();
}

// ---------- AI predictive typing + smart replies (club) ----------

function showPredictiveSuggestionsClub(items) {
  const container = q("club-chat-ai-suggestions");
  if (!container) return;
  container.innerHTML = "";
  if (!items || !items.length) {
    container.classList.add("hidden");
    return;
  }
  container.classList.remove("hidden");

  items.forEach((it) => {
    const btn = document.createElement("button");
    btn.className = "px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200";
    btn.textContent = it;
    btn.addEventListener("click", () => {
      const input = q("club-chat-input");
      if (!input) return;
      input.value = input.value ? input.value + " " + it : it;
      input.focus();
      container.classList.add("hidden");
    });
    container.appendChild(btn);
  });
}

const predictiveDebouncedClub = debounce(async (text) => {
  if (!text || text.trim().length < 2) {
    showPredictiveSuggestionsClub([]);
    return;
  }
  const suggestions = await fetchAiPredictive(text.trim());
  showPredictiveSuggestionsClub(suggestions.slice(0, 5));
}, 350);

function attachPredictiveTypingToChatClub() {
  const input = q("club-chat-input");
  if (!input) return;
  input.addEventListener("input", (ev) => {
    predictiveDebouncedClub(ev.target.value);
  });
}

// Smart replies button
function addSmartReplyButtonToMessage(domMessageEl, msgText) {
  const srBtn = document.createElement("button");
  srBtn.className = "ml-2 text-xs text-primary-600 hover:underline";
  srBtn.textContent = "Suggest replies";
  srBtn.addEventListener("click", async () => {
    srBtn.disabled = true;
    const replies = await fetchAiSmartReplies(msgText);
    srBtn.disabled = false;
    if (!replies || !replies.length) {
      alert("No suggestions");
      return;
    }
    const popup = document.createElement("div");
    popup.className = "mt-1 p-2 bg-white border rounded shadow-sm";
    popup.style.position = "absolute";
    replies.slice(0, 3).forEach((rep) => {
      const rBtn = document.createElement("button");
      rBtn.className =
        "block w-full text-left px-2 py-1 text-xs hover:bg-slate-50";
      rBtn.textContent = rep;
      rBtn.addEventListener("click", () => {
        q("club-chat-input").value = rep;
        // optionally auto-send:
        // q("club-chat-send").click();
        if (popup.parentElement) popup.parentElement.removeChild(popup);
      });
      popup.appendChild(rBtn);
    });
    const rect = domMessageEl.getBoundingClientRect();
    popup.style.left = `${Math.max(8, rect.left)}px`;
    popup.style.top = `${rect.bottom + 6 + window.scrollY}px`;
    document.body.appendChild(popup);

    function onDoc(e) {
      if (!popup.contains(e.target)) {
        if (popup.parentElement) popup.parentElement.removeChild(popup);
        document.removeEventListener("click", onDoc);
      }
    }
    setTimeout(() => document.addEventListener("click", onDoc), 20);
  });

  domMessageEl.appendChild(srBtn);
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  // club chat wiring
  const clubId = getParam("id");
  if (clubId) {
    setupClubChat(clubId);
    loadClubChatHistory(clubId);
  }

  // wire join/leave
  q("club-join-btn")?.addEventListener("click", joinClub);
  q("club-leave-btn")?.addEventListener("click", leaveClub);

  loadClub();
});
