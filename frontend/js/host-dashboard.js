// js/host-dashboard.js
if (window.axios) {
  axios.defaults.baseURL = "http://localhost:5000";
  axios.defaults.headers["Content-Type"] = "application/json";
}
const token = localStorage.getItem("community_token");
if (token) axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

function q(id) {
  return document.getElementById(id);
}
function money(n) {
  return typeof n === "number" ? `₹${n.toLocaleString()}` : n ?? "₹—";
}

let EVENTS = [];
let WALLET = { available: 0, pending: 0, transactions: [] };

async function fetchMetrics() {
  try {
    const res = await axios.get("/hosts/metrics");
    const m = res?.data || {};
    q("stat-total-revenue").textContent = money(m.totalRevenue ?? "—");
    q("stat-active-events").textContent = m.activeEvents ?? "—";
    q("stat-total-bookings").textContent = m.totalBookings ?? "—";
    q("stat-wallet-balance").textContent = money(m.walletBalance ?? "—");
  } catch (err) {
    console.warn("Failed to fetch metrics", err);
  }
}

async function fetchEvents() {
  try {
    const res = await axios.get("/hosts/events");
    EVENTS = res?.data?.events || res?.data || [];
    renderEventsTable(EVENTS);
  } catch (err) {
    console.error("Failed to fetch host events", err);
    EVENTS = [];
    renderEventsTable(EVENTS);
  }
}

function renderEventsTable(list) {
  const tbody = q("events-table-body");
  tbody.innerHTML = "";
  if (!list || !list.length) {
    q("events-empty").classList.remove("hidden");
    return;
  }
  q("events-empty").classList.add("hidden");

  list.forEach((ev) => {
    const tr = document.createElement("tr");
    tr.className = "border-t";
    const statusColor =
      ev.status === "PUBLISHED"
        ? "text-emerald-600"
        : ev.status === "DRAFT"
        ? "text-slate-500"
        : "text-slate-400";
    tr.innerHTML = `
      <td class="py-3 px-2">${ev.title || "Untitled"}</td>
      <td class="py-3 px-2 ${statusColor}">${ev.status || "—"}</td>
      <td class="py-3 px-2">${ev.bookingsCount ?? 0}</td>
      <td class="py-3 px-2">${money(ev.revenue ?? 0)}</td>
      <td class="py-3 px-2">
        <div class="flex gap-2">
          <button data-id="${
            ev.id
          }" class="btn-edit px-2 py-1 text-xs rounded bg-white border">Edit</button>
          <button data-id="${
            ev.id
          }" class="btn-analytics px-2 py-1 text-xs rounded bg-white border">Analytics</button>
          <button data-id="${
            ev.id
          }" class="btn-cancel-event px-2 py-1 text-xs rounded border text-red-600">Cancel</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // actions
  tbody.querySelectorAll(".btn-edit").forEach((b) =>
    b.addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.id;
      window.location.href = `create-event.html?id=${id}`;
    })
  );

  tbody.querySelectorAll(".btn-analytics").forEach((b) =>
    b.addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.id;
      window.location.href = `host-analytics.html?id=${id}`;
    })
  );

  tbody.querySelectorAll(".btn-cancel-event").forEach((b) =>
    b.addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.id;
      confirmAction(
        `Cancel event and refund bookings? This cannot be undone.`,
        async () => {
          await cancelEvent(id);
        }
      );
    })
  );
}

async function cancelEvent(eventId) {
  try {
    const resp = await axios.post(`/hosts/events/${eventId}/cancel`);
    alert(resp?.data?.message || "Event cancelled.");
    await refreshAll();
  } catch (err) {
    alert(err?.response?.data?.message || "Failed to cancel event.");
  }
}

async function fetchWallet() {
  try {
    const r = await axios.get("/wallet");
    const d = r?.data || {};
    WALLET = {
      available: d.available ?? 0,
      pending: d.pending ?? 0,
      transactions: d.transactions || [],
    };
    renderWallet();
  } catch (err) {
    console.warn("Failed to fetch wallet", err);
  }
}

function renderWallet() {
  q("wallet-available").textContent = money(WALLET.available);
  q("wallet-pending").textContent = money(WALLET.pending);
  const list = q("tx-list");
  list.innerHTML = "";
  if (!WALLET.transactions.length) {
    list.innerHTML = `<div class="text-slate-500 text-xs">No transactions yet.</div>`;
    return;
  }
  WALLET.transactions.slice(0, 20).forEach((tx) => {
    const div = document.createElement("div");
    div.className = "flex items-center justify-between text-xs py-1 px-1";
    div.innerHTML = `<div class="text-slate-700">${tx.type || "TX"}</div>
                     <div class="text-slate-500">${new Date(
                       tx.createdAt || Date.now()
                     ).toLocaleDateString()}</div>
                     <div class="font-medium">${money(tx.amount)}</div>`;
    list.appendChild(div);
  });
}

function confirmAction(text, onOk) {
  q("confirm-text").textContent = text;
  const modal = q("confirm-modal");
  modal.classList.remove("hidden");
  modal.style.display = "flex";
  function cleanup() {
    modal.classList.add("hidden");
    modal.style.display = "";
    q("confirm-ok").removeEventListener("click", okHandler);
    q("confirm-cancel").removeEventListener("click", cancelHandler);
  }
  function okHandler() {
    cleanup();
    onOk && onOk();
  }
  function cancelHandler() {
    cleanup();
  }
  q("confirm-ok").addEventListener("click", okHandler);
  q("confirm-cancel").addEventListener("click", cancelHandler);
}

async function withdraw() {
  confirmAction(
    "Withdraw available balance to your linked bank account?",
    async () => {
      try {
        const r = await axios.post("/wallet/withdraw", {
          amount: WALLET.available,
        });
        alert(r?.data?.message || "Withdrawal initiated.");
        await fetchWallet();
      } catch (err) {
        alert(err?.response?.data?.message || "Withdraw failed.");
      }
    }
  );
}

async function refreshAll() {
  await Promise.allSettled([fetchMetrics(), fetchEvents(), fetchWallet()]);
}

// Filters
q("events-filter")?.addEventListener(
  "input",
  debounce(function (e) {
    const v = e.target.value.toLowerCase().trim();
    const filtered = EVENTS.filter((ev) => {
      if (!v) return true;
      return (
        (ev.title || "").toLowerCase().includes(v) ||
        (ev.status || "").toLowerCase().includes(v)
      );
    });
    renderEventsTable(filtered);
  }, 250)
);

q("refresh-btn")?.addEventListener("click", refreshAll);
q("wallet-refresh-btn")?.addEventListener("click", fetchWallet);
q("withdraw-btn")?.addEventListener("click", withdraw);

// on load
document.addEventListener("DOMContentLoaded", async () => {
  // optionally show host name if stored
  try {
    const user = JSON.parse(localStorage.getItem("community_user") || "{}");
    if (user && user.name) q("nav-user-name").textContent = user.name;
  } catch (e) {}

  await refreshAll();
});

// small debounce util
function debounce(fn, wait = 200) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}
