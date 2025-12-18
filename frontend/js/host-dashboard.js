// ---------- Axios ----------
axios.defaults.baseURL = "http://localhost:5000";
axios.defaults.headers["Content-Type"] = "application/json";

const token = localStorage.getItem("community_token");
if (token) axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

const ME = JSON.parse(localStorage.getItem("community_user") || "{}");

const q = (id) => document.getElementById(id);
function money(n) {
  const val = Number(n);
  return !isNaN(val) ? `₹${val.toLocaleString()}` : "₹—";
}

let EVENTS = [];
let BOOKINGS = [];

// ---------- Tabs ----------
q("tab-events").onclick = () => switchTab("events");
q("tab-bookings").onclick = () => switchTab("bookings");

function switchTab(tab) {
  if (tab === "events") {
    q("events-section").classList.remove("hidden");
    q("bookings-section").classList.add("hidden");
    q("tab-events").className =
      "px-4 py-2 rounded-full bg-primary-600 text-white text-sm";
    q("tab-bookings").className =
      "px-4 py-2 rounded-full bg-white border text-sm";
  } else {
    q("events-section").classList.add("hidden");
    q("bookings-section").classList.remove("hidden");
    q("tab-bookings").className =
      "px-4 py-2 rounded-full bg-primary-600 text-white text-sm";
    q("tab-events").className =
      "px-4 py-2 rounded-full bg-white border text-sm";
    fetchBookings();
  }
}

// ---------- Metrics ----------
async function fetchMetrics() {
  const r = await axios.get("/hosts/metrics");
  q("stat-total-revenue").textContent = money(r.data.totalRevenue);
  q("stat-active-events").textContent = r.data.activeEvents;
  q("stat-total-bookings").textContent = r.data.totalBookings;
}

// ---------- Events ----------
async function fetchEvents() {
  const r = await axios.get("/hosts/events");
  EVENTS = r.data.events || [];
  renderEvents();
}

function renderEvents() {
  const body = q("events-table-body");
  body.innerHTML = "";

  if (!EVENTS.length) {
    q("events-empty").classList.remove("hidden");
    return;
  }

  q("events-empty").classList.add("hidden");

  EVENTS.forEach((ev) => {
    const tr = document.createElement("tr");
    tr.className = "border-t";

    tr.innerHTML = `
      <td class="py-2">${ev.title}</td>
      <td>${ev.status}</td>
      <td>${ev.bookingsCount}</td>
      <td>${money(ev.revenue)}</td>
      <td class="flex gap-2">
        <button class="text-sm border px-2" onclick="editEvent('${
          ev.id
        }')">Edit</button>
        ${
          ev.status === "PUBLISHED"
            ? `<button class="text-sm border px-2 text-red-600" onclick="cancelEvent('${ev.id}')">Cancel</button>`
            : ""
        }
        ${
          ["CANCELLED", "COMPLETED", "DRAFT"].includes(ev.status)
            ? `<button class="text-sm bg-red-600 text-white px-2" onclick="deleteEvent('${ev.id}')">Delete</button>`
            : ""
        }
      </td>
    `;
    body.appendChild(tr);
  });
}

window.editEvent = (id) =>
  (window.location.href = `create-event.html?id=${id}`);

async function cancelEvent(id) {
  confirmAction("Cancel this event?", async () => {
    await axios.post(`/events/${id}/cancel`);
    fetchEvents();
  });
}

async function deleteEvent(id) {
  confirmAction("Delete this event permanently?", async () => {
    await axios.delete(`/events/${id}`);
    fetchEvents();
  });
}

// ---------- Bookings ----------
async function fetchBookings() {
  const r = await axios.get("/hosts/bookings");
  BOOKINGS = r.data.bookings || [];
  renderBookings();
}

function renderBookings() {
  const body = q("bookings-table-body");
  body.innerHTML = "";

  if (!BOOKINGS.length) {
    q("bookings-empty").classList.remove("hidden");
    return;
  }

  q("bookings-empty").classList.add("hidden");

  BOOKINGS.forEach((b) => {
    const tr = document.createElement("tr");
    tr.className = "border-t";

    tr.innerHTML = `
      <td>${b.user?.name}</td>
      <td>${b.event?.title}</td>
      <td>${b.ticketType?.name}</td>
      <td>${b.quantity}</td>
      <td>${money(b.totalAmount ?? 0)}</td>
      <td>
        <select onchange="updateBooking('${b.id}', this.value)">
          ${["PENDING", "CONFIRMED", "FAILED"].map(
            (s) => `<option ${s === b.status ? "selected" : ""}>${s}</option>`
          )}
        </select>
      </td>
      <td>
        <button class="text-red-600 text-xs" onclick="deleteBooking('${b.id}')">
          Delete
        </button>
      </td>
    `;
    body.appendChild(tr);
  });
}

window.updateBooking = async (id, status) => {
  await axios.put(`/bookings/${id}/status`, { status });
};

window.deleteBooking = async (id) => {
  confirmAction("Delete booking?", async () => {
    await axios.delete(`/bookings/${id}`);
    fetchBookings();
  });
};

// ---------- Confirm ----------
function confirmAction(text, onOk) {
  q("confirm-text").textContent = text;
  q("confirm-modal").classList.remove("hidden");

  q("confirm-ok").onclick = () => {
    q("confirm-modal").classList.add("hidden");
    onOk();
  };
  q("confirm-cancel").onclick = () =>
    q("confirm-modal").classList.add("hidden");
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", async () => {
  if (ME?.name) q("nav-user-name").textContent = ME.name;
  await fetchMetrics();
  await fetchEvents();
});
