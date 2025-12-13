// frontend/js/create-event.js

// Axios setup
axios.defaults.baseURL = "http://localhost:5000";
axios.defaults.headers["Content-Type"] = "application/json";

const token = localStorage.getItem("community_token");
if (!token) {
  window.location.href = "auth.html#login";
}
axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

const form = document.getElementById("create-event-form");
const errorBox = document.getElementById("error-box");
const ticketTypesWrap = document.getElementById("ticket-types");
const addTicketBtn = document.getElementById("add-ticket-btn");

// Role check (HOST / ADMIN only)
const me = JSON.parse(localStorage.getItem("community_user") || "{}");
if (!["HOST", "ADMIN"].includes(me.role)) {
  alert("Access denied");
  window.location.href = "index.html";
}

// Ticket type row
function addTicketRow() {
  const div = document.createElement("div");
  div.className = "grid grid-cols-1 sm:grid-cols-3 gap-2";
  div.innerHTML = `
    <input placeholder="Name" class="px-3 py-2 border rounded" />
    <input type="number" placeholder="Price" class="px-3 py-2 border rounded" />
    <input type="number" placeholder="Quota" class="px-3 py-2 border rounded" />
  `;
  ticketTypesWrap.appendChild(div);
}

// Add default ticket
addTicketRow();
addTicketBtn.addEventListener("click", addTicketRow);

// Submit
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.classList.add("hidden");

  try {
    const payload = {
      title: document.getElementById("title").value,
      description: document.getElementById("description").value,
      startTime: document.getElementById("startTime").value,
      endTime: document.getElementById("endTime").value,
      city: document.getElementById("city").value,
      venue: document.getElementById("venue").value,
      maxSeats: Number(document.getElementById("maxSeats").value),
      ticketTypes: [],
    };

    // Ticket types
    ticketTypesWrap.querySelectorAll("div").forEach((row) => {
      const inputs = row.querySelectorAll("input");
      const name = inputs[0].value;
      const price = Number(inputs[1].value || 0);
      const quota = Number(inputs[2].value || 0);
      if (name) payload.ticketTypes.push({ name, price, quota });
    });

    // 1️⃣ Create event
    const eventResp = await axios.post("/events", payload);
    const eventId = eventResp.data?.event?.id || eventResp.data?.id;

    // 2️⃣ Upload banner if exists
    const bannerInput = document.getElementById("banner");
    if (bannerInput.files.length && eventId) {
      const fd = new FormData();
      fd.append("banner", bannerInput.files[0]);

      await axios.post(`/events/${eventId}/banner`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    }

    alert("Event created successfully");
    window.location.href = "host-dashboard.html";
  } catch (err) {
    console.error(err);
    errorBox.textContent =
      err?.response?.data?.message || "Failed to create event";
    errorBox.classList.remove("hidden");
  }
});
