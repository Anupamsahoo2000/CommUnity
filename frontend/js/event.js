// js/event.js

// ---------- Axios base config ----------
if (window.axios) {
  axios.defaults.baseURL = "http://localhost:5000";
  axios.defaults.headers["Content-Type"] = "application/json";
}

// Attach token if present
const storedToken = localStorage.getItem("community_token");
if (storedToken) {
  axios.defaults.headers.common["Authorization"] = `Bearer ${storedToken}`;
}

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
  const percent = 0.02;
  const flat = 0;
  return Math.round(base * qty * percent + flat);
}

let CURRENT_EVENT = null;
let SELECTED_TICKET = null;
let SELECTED_QTY = 1;
let socket = null;
let seatPollInterval = null;

// ---------- Ticket types UI ----------
function renderTicketTypes(ticketTypes) {
  const container = qsel("ticket-types");
  container.innerHTML = "";

  if (!ticketTypes || !ticketTypes.length) {
    container.innerHTML =
      '<div class="text-sm text-slate-500">No ticket types available.</div>';
    qsel("ticket-base-price").textContent = "—";
    qsel("break-base").textContent = "—";
    qsel("break-fee").textContent = "—";
    qsel("break-total").textContent = "—";
    return;
  }

  ticketTypes.forEach((t, idx) => {
    // t: { id, name, price, quota, remaining / availableSeats }
    const remaining =
      t.remaining !== undefined ? t.remaining : t.availableSeats;
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
            remaining !== undefined ? remaining + " left" : ""
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

      // reset all qty inputs to 1
      container.querySelectorAll(".qty-input").forEach((inp) => {
        inp.value = "1";
      });

      updatePriceBreakdown(ticketTypes);
    });
  });

  container.querySelectorAll(".qty-incr").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.for;
      const input = container.querySelector(`.qty-input[data-for="${id}"]`);
      if (!input) return;
      let v = Number(input.value || 1);
      v = v + 1;
      input.value = v;
      SELECTED_QTY = v;
      updatePriceBreakdown(ticketTypes);
    });
  });

  container.querySelectorAll(".qty-decr").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.for;
      const input = container.querySelector(`.qty-input[data-for="${id}"]`);
      if (!input) return;
      let v = Math.max(1, Number(input.value || 1) - 1);
      input.value = v;
      SELECTED_QTY = v;
      updatePriceBreakdown(ticketTypes);
    });
  });

  container.querySelectorAll(".qty-input").forEach((inp) => {
    inp.addEventListener("change", () => {
      let v = Math.max(1, Number(inp.value || 1));
      inp.value = v;
      SELECTED_QTY = v;
      updatePriceBreakdown(ticketTypes);
    });
  });

  // initial selection
  SELECTED_TICKET = ticketTypes[0];
  SELECTED_QTY = 1;
  updatePriceBreakdown(ticketTypes);
}

function updatePriceBreakdown(ticketTypes) {
  const baseEl = qsel("break-base");
  const feeEl = qsel("break-fee");
  const totalEl = qsel("break-total");
  const basePriceTop = qsel("ticket-base-price");

  if (!SELECTED_TICKET) {
    if (baseEl) baseEl.textContent = "—";
    if (feeEl) feeEl.textContent = "—";
    if (totalEl) totalEl.textContent = "—";
    if (basePriceTop) basePriceTop.textContent = "—";
    return;
  }

  const base = Number(SELECTED_TICKET.price || 0);
  const qty = Number(SELECTED_QTY || 1);

  // simple cap: if we know remaining seats, do not allow more than remaining
  const remaining =
    SELECTED_TICKET.remaining !== undefined
      ? SELECTED_TICKET.remaining
      : SELECTED_TICKET.availableSeats;
  if (typeof remaining === "number" && qty > remaining) {
    SELECTED_QTY = remaining || 1;
  }

  const baseTotal = base * SELECTED_QTY;
  const fee = calcPlatformFee(base, SELECTED_QTY);
  const total = baseTotal + fee;

  if (baseEl) baseEl.textContent = baseTotal ? `₹${baseTotal}` : "Free";
  if (feeEl) feeEl.textContent = fee ? `₹${fee}` : "₹0";
  if (totalEl)
    totalEl.textContent = total
      ? `₹${total}`
      : baseTotal
      ? `₹${baseTotal}`
      : "Free";
  if (basePriceTop)
    basePriceTop.textContent = base
      ? `₹${base} x ${SELECTED_QTY}`
      : "Free ticket";
}

// ---------- Event + tickets loading ----------
async function loadEvent() {
  const id = getParam("id");
  if (!id) {
    showError("No event id in URL");
    return;
  }
  hideError();

  try {
    // NOTE: using /api/events/:id
    const res = await axios.get(`/events/${id}`);
    const event = res?.data?.event || res?.data;
    if (!event) throw new Error("Event not found");

    CURRENT_EVENT = event;

    // populate UI
    qsel("event-title").textContent = event.title || "Untitled";

    // meta: date/time + city + category
    let metaParts = [];
    if (event.startTime) {
      const d = new Date(event.startTime);
      metaParts.push(
        d.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      );
      metaParts.push(
        d.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }
    if (event.city) metaParts.push(event.city);
    if (event.category) metaParts.push(event.category);
    qsel("event-meta").textContent = metaParts.join(" · ") || "Details TBA";

    qsel("event-desc").innerHTML = event.description
      ? `<p>${event.description}</p>`
      : '<p class="text-sm text-slate-500">No description</p>';

    qsel("event-includes").innerHTML = (
      event.includes || ["Entry to event", "Basic support"]
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

    // initial seats left
    updateSeatsDisplay(event.seatsLeft ?? event.maxSeats ?? "—");

    // ticket types: prefer dedicated endpoint
    let ticketTypes = [];
    try {
      const tResp = await axios.get(`/events/${id}/tickets`);
      const data = tResp?.data || {};
      // backend may return { tickets: [...] } or an array directly
      ticketTypes = data.tickets || data.data || data || [];
      if (!Array.isArray(ticketTypes)) ticketTypes = [];
    } catch (err) {
      console.warn(
        "Ticket types endpoint failed, falling back to event.ticketTypes",
        err
      );
      if (
        event.ticketTypes &&
        Array.isArray(event.ticketTypes) &&
        event.ticketTypes.length
      ) {
        ticketTypes = event.ticketTypes;
      } else {
        // final fallback: default ticket
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

    // show card / hide loader
    qsel("event-card").classList.remove("hidden");
    qsel("event-loading").classList.add("hidden");

    // start seats live updates + chat setup
    startSeatsLive(id);
    setupChat(id);
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

// ---------- Seats polling + socket.io ----------
function startSeatsLive(eventId) {
  // poll every 10s
  if (seatPollInterval) clearInterval(seatPollInterval);
  seatPollInterval = setInterval(async () => {
    try {
      const r = await axios.get(`/events/${eventId}/seats`);
      const seatsLeft = r?.data?.seatsLeft ?? r?.data?.remaining ?? null;
      if (seatsLeft !== undefined) updateSeatsDisplay(seatsLeft);
    } catch (e) {
      // ignore errors in polling
    }
  }, 10000);

  // socket.io realtime (if backend supports it)
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

    // chat messages
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

// ---------- Booking flow ----------
async function bookNow() {
  if (!CURRENT_EVENT) {
    alert("Event not loaded");
    return;
  }
  if (!SELECTED_TICKET) {
    alert("Select a ticket type");
    return;
  }

  const token = localStorage.getItem("community_token");
  if (!token) {
    window.location.href = "auth.html#login";
    return;
  }

  const quantity = Number(SELECTED_QTY || 1);
  const payload = {
    eventId: CURRENT_EVENT.id,
    ticketTypeId: SELECTED_TICKET.id,
    quantity,
  };

  const btn = qsel("book-now-btn");
  const resultBox = qsel("booking-result");

  if (resultBox) {
    resultBox.classList.add("hidden");
    resultBox.textContent = "";
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Processing...";
  }

  try {
    // 1) Create booking
    const bookingResp = await axios.post("/bookings", payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const booking = bookingResp?.data?.booking || bookingResp?.data;
    if (!booking || !booking.id) {
      throw new Error("Unexpected booking response");
    }

    if (resultBox) {
      resultBox.classList.remove("hidden");
      resultBox.className = "mt-3 text-sm text-emerald-600";
      resultBox.textContent = "Booking created. Creating payment order...";
    }

    // 2) Create Cashfree order for this booking
    const payResp = await axios.post(
      "/payments/create-order",
      { bookingId: booking.id },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const { order_id, payment_session_id } = payResp.data || {};
    console.log("Cashfree order:", order_id, payment_session_id);

    if (resultBox) {
      resultBox.classList.remove("hidden");
      resultBox.className = "mt-3 text-sm text-emerald-600";
      resultBox.textContent =
        "Payment order created. In development, you can mark it success via webhook or check API. Your booking will appear in My Bookings.";
    }

    // Optionally, you can redirect to dashboard:
    // setTimeout(() => (window.location.href = "dashboard.html"), 1200);
  } catch (err) {
    console.error("Booking/payment failed", err);
    const msg =
      err?.response?.data?.message ||
      "Failed to create booking or payment. Try again.";
    if (resultBox) {
      resultBox.classList.remove("hidden");
      resultBox.className = "mt-3 text-sm text-red-600";
      resultBox.textContent = msg;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Book Now";
    }
  }
}

// ---------- Chat helpers ----------
function appendChatMessage(msg) {
  const box = qsel("chat-messages");
  if (!box) return;
  const el = document.createElement("div");
  el.className = `mb-2 ${
    msg.isOrganizer
      ? "text-sm font-medium text-primary-700"
      : "text-sm text-slate-700"
  }`;
  el.innerHTML = `
    <div class="text-xs text-slate-500">
      ${msg.senderName || "User"} · ${new Date(
    msg.createdAt || Date.now()
  ).toLocaleTimeString()}
    </div>
    <div>${msg.text}</div>
  `;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

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

    try {
      if (socket && socket.connected) {
        socket.emit("chat_message", { eventId, text });
      } else {
        // REST fallback
        await axios.post(`/events/${eventId}/chat`, { text });
      }
    } catch (err) {
      console.warn("Failed to send chat message", err);
    }
  });

  // typing indicator
  input?.addEventListener("input", () => {
    if (socket && socket.connected) {
      socket.emit("typing", { eventId });
    }
  });
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  qsel("book-now-btn")?.addEventListener("click", bookNow);
  qsel("open-chat-btn")?.addEventListener("click", () => {
    qsel("chat-widget")?.classList.toggle("hidden");
  });

  loadEvent();
});
