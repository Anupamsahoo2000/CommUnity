// js/event.js
if (window.axios) {
  axios.defaults.baseURL = "http://localhost:5000";
  axios.defaults.headers["Content-Type"] = "application/json";
}

// attach token if present
const token = localStorage.getItem("community_token");
if (token) axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

function qsel(id) {
  return document.getElementById(id);
}
function showError(msg) {
  const e = qsel("event-error");
  if (e) {
    e.textContent = msg;
    e.classList.remove("hidden");
  }
}
function hideError() {
  const e = qsel("event-error");
  if (e) {
    e.classList.add("hidden");
    e.textContent = "";
  }
}

function getParam(name) {
  const p = new URLSearchParams(window.location.search);
  return p.get(name);
}

// simple platform fee calc (example: 5% + ₹10)
function calcPlatformFee(base, qty) {
  const percent = 0.05;
  const flat = 10;
  return Math.round(base * qty * percent + flat);
}

let CURRENT_EVENT = null;
let SELECTED_TICKET = null;
let SELECTED_QTY = 1;
let socket = null;
let seatPollInterval = null;

// render ticket types panel
function renderTicketTypes(ticketTypes) {
  const container = qsel("ticket-types");
  container.innerHTML = "";
  if (!ticketTypes || !ticketTypes.length) {
    container.innerHTML =
      '<div class="text-sm text-slate-500">No ticket types available.</div>';
    return;
  }

  ticketTypes.forEach((t, idx) => {
    // t: { id, name, price, quota, remaining }
    const div = document.createElement("div");
    div.className = "border rounded-lg p-3";

    div.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div>
          <div class="font-semibold">${t.name}</div>
          <div class="text-xs text-slate-500">${
            t.quota ? t.quota + " seats" : "Unlimited"
          }</div>
        </div>
        <div class="text-right">
          <div class="text-sm font-semibold">₹${t.price ?? 0}</div>
          <div class="text-xs text-slate-500">${
            t.remaining !== undefined ? t.remaining + " left" : ""
          }</div>
        </div>
      </div>

      <div class="mt-3 flex items-center gap-2">
        <label class="inline-flex items-center gap-2 text-sm">
          <input type="radio" name="ticket-type" value="${t.id}" ${
      idx === 0 ? "checked" : ""
    } />
          <span class="text-sm">${t.name}</span>
        </label>

        <div class="ml-auto inline-flex items-center gap-2">
          <button class="qty-decr px-2 py-1 rounded border" data-for="${
            t.id
          }">-</button>
          <input type="number" min="1" value="${
            idx === 0 ? 1 : 1
          }" class="w-14 text-center text-sm qty-input" data-for="${t.id}" />
          <button class="qty-incr px-2 py-1 rounded border" data-for="${
            t.id
          }">+</button>
        </div>
      </div>
    `;

    container.appendChild(div);
  });

  // attach handlers
  container.querySelectorAll('input[name="ticket-type"]').forEach((el) => {
    el.addEventListener("change", (ev) => {
      const id = ev.target.value;
      SELECTED_TICKET = ticketTypes.find((t) => String(t.id) === String(id));
      SELECTED_QTY = 1;
      updatePriceBreakdown();
    });
  });

  container.querySelectorAll(".qty-incr").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = btn.dataset.for;
      const input = container.querySelector(`.qty-input[data-for="${id}"]`);
      if (!input) return;
      let v = Number(input.value || 1);
      v = v + 1;
      input.value = v;
      SELECTED_QTY = v;
      updatePriceBreakdown();
    });
  });

  container.querySelectorAll(".qty-decr").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = btn.dataset.for;
      const input = container.querySelector(`.qty-input[data-for="${id}"]`);
      if (!input) return;
      let v = Math.max(1, Number(input.value || 1) - 1);
      input.value = v;
      SELECTED_QTY = v;
      updatePriceBreakdown();
    });
  });

  container.querySelectorAll(".qty-input").forEach((inp) => {
    inp.addEventListener("change", () => {
      let v = Math.max(1, Number(inp.value || 1));
      inp.value = v;
      SELECTED_QTY = v;
      updatePriceBreakdown();
    });
  });

  // set initial selection
  SELECTED_TICKET = ticketTypes[0];
  SELECTED_QTY = 1;
  updatePriceBreakdown();
}

function updatePriceBreakdown() {
  const baseEl = qsel("break-base"),
    feeEl = qsel("break-fee"),
    totalEl = qsel("break-total"),
    basePriceTop = qsel("ticket-base-price");

  if (!SELECTED_TICKET) {
    baseEl.textContent = "—";
    feeEl.textContent = "—";
    totalEl.textContent = "—";
    if (basePriceTop) basePriceTop.textContent = "—";
    return;
  }

  const base = Number(SELECTED_TICKET.price || 0);
  const qty = Number(SELECTED_QTY || 1);
  const baseTotal = base * qty;
  const fee = calcPlatformFee(base, qty);
  const total = baseTotal + fee;

  baseEl.textContent = `₹${baseTotal}`;
  feeEl.textContent = `₹${fee}`;
  totalEl.textContent = `₹${total}`;
  if (basePriceTop) basePriceTop.textContent = `₹${base} x ${qty}`;
}

// Fetch event details
async function loadEvent() {
  const id = getParam("id");
  if (!id) {
    showError("No event id in URL");
    return;
  }
  hideError();

  try {
    const res = await axios.get(`/events/${id}`);
    const event = res?.data?.event || res?.data;
    if (!event) throw new Error("Event not found");

    CURRENT_EVENT = event;

    // populate UI
    qsel("event-title").textContent = event.title || "Untitled";
    qsel("event-meta").textContent = `${event.city || ""} · ${
      event.category || ""
    }`;
    qsel("event-desc").innerHTML = event.description
      ? `<p>${event.description}</p>`
      : '<p class="text-sm text-slate-500">No description</p>';
    qsel("event-includes").innerHTML = (
      event.includes || ["Ticket, refreshments"]
    )
      .map((i) => `<li>${i}</li>`)
      .join("");
    qsel("event-rules").innerHTML = (
      event.rules || "Standard cancellation policy applies."
    ).replace(/\n/g, "<br/>");

    // tags
    qsel("event-tags").textContent =
      event.tags && Array.isArray(event.tags)
        ? event.tags.join(" · ")
        : event.category || "";

    // banner
    const banner = qsel("event-banner");
    banner.innerHTML = "";
    if (event.bannerUrl) {
      const img = document.createElement("img");
      img.src = event.bannerUrl;
      img.alt = event.title || "";
      img.className = "w-full h-full object-cover";
      banner.appendChild(img);
    } else {
      banner.innerHTML =
        '<div class="w-full h-full flex items-center justify-center text-slate-400">No image</div>';
    }

    // seats left
    updateSeatsDisplay(event.seatsLeft ?? event.maxSeats ?? "—");

    // ticket types - fetch from backend if separate endpoint exists, else use event.ticketTypes
    let ticketTypes = [];
    if (
      event.ticketTypes &&
      Array.isArray(event.ticketTypes) &&
      event.ticketTypes.length
    ) {
      ticketTypes = event.ticketTypes;
    } else {
      // try GET /events/:id/tickets
      try {
        const tResp = await axios.get(`/events/${id}/tickets`);
        ticketTypes = tResp?.data?.data || tResp?.data || [];
      } catch (err) {
        // fallback example: create a default regular ticket
        ticketTypes = [
          {
            id: "default",
            name: "Regular",
            price: event.basePrice || 0,
            quota: event.maxSeats || null,
            remaining: event.maxSeats || null,
          },
        ];
      }
    }

    renderTicketTypes(ticketTypes);

    // show card
    qsel("event-card").classList.remove("hidden");
    qsel("event-loading").classList.add("hidden");

    // start seats polling / socket
    startSeatsLive(id);
  } catch (err) {
    console.error(err);
    showError(
      err?.response?.data?.message || err.message || "Failed to load event."
    );
  }
}

// seats UI
function updateSeatsDisplay(v) {
  const el = qsel("seats-left");
  if (!el) return;
  el.textContent = v === null || v === undefined ? "—" : String(v);
}

// simple poll + optional socket integration
function startSeatsLive(eventId) {
  // poll every 10s
  if (seatPollInterval) clearInterval(seatPollInterval);
  seatPollInterval = setInterval(async () => {
    try {
      const r = await axios.get(`/events/${eventId}/seats`);
      const seatsLeft = r?.data?.seatsLeft ?? r?.data?.remaining ?? null;
      if (seatsLeft !== undefined) updateSeatsDisplay(seatsLeft);
    } catch (e) {
      // ignore
    }
  }, 10000);

  // socket.io real-time (if server emits room 'event:<id>' with 'seats' updates and chat)
  try {
    socket = io(axios.defaults.baseURL || "/", { transports: ["websocket"] });
    socket.on("connect", () => {
      socket.emit("join_event_room", { eventId });
    });
    socket.on("seats_update", (payload) => {
      if (payload?.eventId === eventId && payload?.seatsLeft !== undefined) {
        updateSeatsDisplay(payload.seatsLeft);
      }
    });

    // chat events
    socket.on("chat_message", (msg) => {
      appendChatMessage(msg);
    });
    socket.on("typing", ({ user }) => {
      const el = qsel("chat-typing");
      if (!el) return;
      el.classList.remove("hidden");
      el.textContent = `${user} is typing...`;
      setTimeout(() => el.classList.add("hidden"), 1500);
    });
  } catch (err) {
    console.warn("Socket.io connection failed", err);
  }
}

// booking flow
async function bookNow() {
  if (!CURRENT_EVENT) {
    alert("Event not loaded");
    return;
  }
  if (!SELECTED_TICKET) {
    alert("Select a ticket type");
    return;
  }

  const payload = {
    eventId: CURRENT_EVENT.id,
    ticketTypeId: SELECTED_TICKET.id,
    quantity: Number(SELECTED_QTY || 1),
  };

  // require auth
  const token = localStorage.getItem("community_token");
  if (!token) {
    window.location.href = "auth.html#login";
    return;
  }

  // disable button
  const btn = qsel("book-now-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Processing...";
  }

  try {
    const resp = await axios.post("/bookings", payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // expect { booking: {...}, paymentUrl } or the created booking
    const booking = resp?.data?.booking || resp?.data;
    const paymentUrl = resp?.data?.paymentUrl;

    if (paymentUrl) {
      // redirect to gateway or open in new tab
      window.open(paymentUrl, "_blank");
      qsel("booking-result").classList.remove("hidden");
      qsel("booking-result").className = "text-sm text-emerald-600 mt-3";
      qsel("booking-result").textContent =
        "Payment opened in new tab. Complete payment to confirm booking.";
    } else if (booking) {
      qsel("booking-result").classList.remove("hidden");
      qsel("booking-result").className = "text-sm text-emerald-600 mt-3";
      qsel("booking-result").textContent =
        "Booking created. Check dashboard for tickets.";
      // optionally redirect to booking or ticket page
      setTimeout(() => (window.location.href = "dashboard.html"), 900);
    } else {
      throw new Error("Unexpected booking response");
    }
  } catch (err) {
    console.error("Booking failed", err);
    const msg = err?.response?.data?.message || "Failed to book. Try again.";
    qsel("booking-result").classList.remove("hidden");
    qsel("booking-result").className = "text-sm text-red-600 mt-3";
    qsel("booking-result").textContent = msg;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Book Now";
    }
  }
}

// Chat helpers
function appendChatMessage(msg) {
  const box = qsel("chat-messages");
  if (!box) return;
  const el = document.createElement("div");
  el.className = `mb-2 ${
    msg.isOrganizer
      ? "text-sm font-medium text-primary-700"
      : "text-sm text-slate-700"
  }`;
  el.innerHTML = `<div class="text-xs text-slate-500">${
    msg.senderName || "User"
  } · ${new Date(msg.createdAt || Date.now()).toLocaleTimeString()}</div>
                  <div>${msg.text}</div>`;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

// chat UI wiring
function setupChat(eventId) {
  const openBtn = qsel("open-chat-btn");
  const chatWidget = qsel("chat-widget");
  const closeBtn = qsel("chat-close-btn");
  const sendBtn = qsel("chat-send");
  const input = qsel("chat-input");

  if (!openBtn || !chatWidget) return;
  openBtn.addEventListener("click", () =>
    chatWidget.classList.toggle("hidden")
  );
  closeBtn?.addEventListener("click", () => chatWidget.classList.add("hidden"));

  // send message
  sendBtn?.addEventListener("click", async () => {
    const text = input.value.trim();
    if (!text) return;
    // optimistic append
    appendChatMessage({ senderName: "You", text, createdAt: Date.now() });
    input.value = "";

    // send to server via socket or REST
    try {
      if (socket && socket.connected) {
        socket.emit("chat_message", { eventId, text });
      } else {
        // fallback to API
        await axios.post(`/events/${eventId}/chat`, { text });
      }
    } catch (err) {
      console.warn("Failed to send chat message", err);
    }
  });

  // typing
  input?.addEventListener("input", () => {
    if (socket && socket.connected) socket.emit("typing", { eventId });
  });
}

// init
document.addEventListener("DOMContentLoaded", () => {
  qsel("book-now-btn")?.addEventListener("click", bookNow);
  qsel("open-chat-btn")?.addEventListener("click", () => {
    qsel("chat-widget")?.classList.toggle("hidden");
  });
  loadEvent().then(() => {
    const id = getParam("id");
    setupChat(id);
  });
});
