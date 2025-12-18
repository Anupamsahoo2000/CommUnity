// frontend/js/create-event.js

axios.defaults.baseURL = "http://localhost:5000";
axios.defaults.headers["Content-Type"] = "application/json";

const token = localStorage.getItem("community_token");
if (!token) window.location.href = "auth.html#login";
axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

const form = document.getElementById("create-event-form");
const errorBox = document.getElementById("error-box");
const ticketTypesWrap = document.getElementById("ticket-types");
const addTicketBtn = document.getElementById("add-ticket-btn");

// Role check
const me = JSON.parse(localStorage.getItem("community_user") || "{}");
if (!["HOST", "ADMIN"].includes(me.role)) {
  alert("Access denied");
  window.location.href = "index.html";
}

// Ticket row
function addTicketRow() {
  const div = document.createElement("div");
  div.className = "grid grid-cols-1 sm:grid-cols-3 gap-2";
  div.innerHTML = `
    <input placeholder="Name" class="px-3 py-2 border rounded" />
    <input type="number" min="0" placeholder="Price" class="px-3 py-2 border rounded" />
    <input type="number" min="1" placeholder="Quota *" class="px-3 py-2 border rounded" />
  `;
  ticketTypesWrap.appendChild(div);
}

addTicketRow();
addTicketBtn.addEventListener("click", addTicketRow);

// Submit
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.classList.add("hidden");

  try {
    const payload = {
      title: document.getElementById("title").value.trim(),
      description: document.getElementById("description").value,
      category: document.getElementById("category").value,
      startTime: new Date(
        document.getElementById("startTime").value
      ).toISOString(),
      endTime: document.getElementById("endTime").value
        ? new Date(document.getElementById("endTime").value).toISOString()
        : null,
      city: document.getElementById("city").value,
      location: document.getElementById("venue").value,
      maxSeats: Number(document.getElementById("maxSeats").value),
      ticketTypes: [],
    };

    if (!payload.title || !payload.startTime) {
      throw new Error("Title and start time are required");
    }

    // Ticket types (IMPORTANT FIX)
    ticketTypesWrap.querySelectorAll("div").forEach((row) => {
      const inputs = row.querySelectorAll("input");
      const name = inputs[0].value.trim();
      const price = Number(inputs[1].value || 0);
      const quota = Number(inputs[2].value || 0);

      if (name && quota > 0) {
        payload.ticketTypes.push({ name, price, quota });
      }
    });

    if (!payload.ticketTypes.length) {
      throw new Error("At least one ticket type with quota > 0 is required");
    }

    // 1️⃣ Create event
    const eventResp = await axios.post("/events", payload);
    const eventId = eventResp.data?.event?.id;

    // 2️⃣ Upload banner
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
    errorBox.textContent =
      err.message || err?.response?.data?.message || "Failed to create event";
    errorBox.classList.remove("hidden");
  }
});
