// Axios base
axios.defaults.baseURL = "http://localhost:5000";
axios.defaults.headers["Content-Type"] = "application/json";

const token = localStorage.getItem("community_token");
if (token) {
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}

function q(id) {
  return document.getElementById(id);
}

// ---------- UI helpers ----------
function showError(msg) {
  q("club-error").textContent = msg;
  q("club-error").classList.remove("hidden");
}
function hideError() {
  q("club-error").classList.add("hidden");
}

// ---------- List clubs ----------
async function loadClubs() {
  hideError();
  try {
    const r = await axios.get("/clubs");
    const clubs = r.data?.data || r.data || [];

    const grid = q("clubs-grid");
    grid.innerHTML = "";

    if (!clubs.length) {
      q("clubs-empty").classList.remove("hidden");
      return;
    }

    q("clubs-empty").classList.add("hidden");

    clubs.forEach((c) => {
      const div = document.createElement("div");
      div.className =
        "bg-white rounded-xl p-4 shadow-sm hover:shadow transition cursor-pointer";

      div.innerHTML = `
        <div class="h-32 bg-slate-200 rounded-lg mb-3 overflow-hidden">
          ${
            c.bannerUrl
              ? `<img src="${c.bannerUrl}" class="w-full h-full object-cover" />`
              : ""
          }
        </div>
        <div class="font-semibold">${c.name}</div>
        <div class="text-xs text-slate-500">
          ${c.category || "Community"} · ${c.memberCount || 0} members
        </div>
      `;

      div.addEventListener("click", () => openClub(c.id));
      grid.appendChild(div);
    });
  } catch (err) {
    showError("Failed to load clubs");
  }
}

// ---------- Open club detail ----------
async function openClub(id) {
  q("clubs-list-view").classList.add("hidden");
  q("club-detail-view").classList.remove("hidden");

  hideError();

  try {
    const r = await axios.get(`/clubs/${id}`);
    const club = r.data?.club || r.data;

    q("club-name").textContent = club.name;
    q("club-category").textContent = club.category || "";
    q("club-members-count").textContent = (club.memberCount || 0) + " members";
    q("club-about").innerHTML =
      club.about || "<p class='text-slate-500'>No description.</p>";

    // banner
    const banner = q("club-banner");
    banner.innerHTML = "";
    if (club.bannerUrl) {
      banner.innerHTML = `<img src="${club.bannerUrl}" class="w-full h-full object-cover" />`;
    }

    // logo
    q("club-logo").textContent = club.name.trim().charAt(0).toUpperCase();

    // join / leave
    q("club-join-btn").classList.toggle("hidden", club.isMember);
    q("club-leave-btn").classList.toggle("hidden", !club.isMember);

    q("club-join-btn").onclick = async () => {
      try {
        await axios.post(`/clubs/${id}/join`);
      } catch (err) {
        // 409 = already a member → ignore
        if (err.response?.status !== 409) {
          alert(err.response?.data?.message || "Failed to join club");
          return;
        }
      }
      // Refresh UI no matter what
      openClub(id);
    };

    q("club-leave-btn").onclick = async () => {
      await axios.post(`/clubs/${id}/leave`);
      openClub(id);
    };

    // events
    // const eventsList = q("club-events-list");
    // eventsList.innerHTML = "";

    // if (club.upcomingEvents?.length) {
    //   q("club-events-empty").classList.add("hidden");
    //   club.upcomingEvents.forEach((e) => {
    //     const d = document.createElement("div");
    //     d.className = "bg-white border rounded-lg p-3 flex gap-3";

    //     d.innerHTML = `
    //       <div class="flex-1">
    //         <div class="font-medium">${e.title}</div>
    //         <div class="text-xs text-slate-500">
    //           ${new Date(e.startTime).toLocaleString()}
    //         </div>
    //       </div>
    //       <a href="event.html?id=${e.id}"
    //         class="text-xs px-3 py-1 rounded-full bg-primary-50 text-primary-700 self-center">
    //         View
    //       </a>
    //     `;
    //     eventsList.appendChild(d);
    //   });
    // } else {
    //   q("club-events-empty").classList.remove("hidden");
    // }

    // chat
    loadClubChat(id);
    q("club-chat-send").onclick = () => sendClubChat(id);
  } catch (err) {
    showError("Failed to load club");
  }
}

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("tab-active"));
    btn.classList.add("tab-active");

    ["about", "chat"].forEach((t) => {
      q("tab-" + t).classList.toggle("hidden", btn.dataset.tab !== t);
    });
  });
});

// ---------- Chat ----------
async function loadClubChat(clubId) {
  const box = q("club-chat-messages");
  if (!box) return;
  box.innerHTML = "";

  try {
    const r = await axios.get(`/clubs/${clubId}/chat`);
    (r.data?.data || []).forEach((m) => appendChat(m));
    box.scrollTop = box.scrollHeight;
  } catch {}
}

function appendChat(msg) {
  const box = q("club-chat-messages");
  const div = document.createElement("div");
  div.className = "mb-2 text-sm";
  div.innerHTML = `
    <div class="text-xs text-slate-500">
      ${msg.senderName || "User"} ·
      ${new Date(msg.createdAt).toLocaleTimeString()}
    </div>
    <div>${msg.text}</div>
  `;
  box.appendChild(div);
}

async function sendClubChat(clubId) {
  const input = q("club-chat-input");
  const text = input.value.trim();
  if (!text) return;

  const token = localStorage.getItem("community_token");
  if (!token) {
    alert("Please login to chat");
    window.location.href = "auth.html#login";
    return;
  }

  appendChat({
    senderName: "You",
    text,
    createdAt: Date.now(),
  });

  input.value = "";

  try {
    await axios.post(`/clubs/${clubId}/chat`, { text });
  } catch (err) {
    alert("Failed to send message");
  }
}

// ---------- Back ----------
q("back-to-clubs").onclick = () => {
  q("club-detail-view").classList.add("hidden");
  q("clubs-list-view").classList.remove("hidden");
};

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", loadClubs);
