// frontend/js/event.js

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

// simple platform fee calc
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

// ---------- Ticket types UI (unchanged) ----------
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
      container
        .querySelectorAll(".qty-input")
        .forEach((inp) => (inp.value = "1"));
      updatePriceBreakdown(ticketTypes);
    });
  });

  container.querySelectorAll(".qty-incr").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.for;
      const input = container.querySelector(`.qty-input[data-for="${id}"]`);
      if (!input) return;
      let v = Number(input.value || 1) + 1;
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

function setupEventBannerUpload(eventId) {
  const wrap = qsel("event-banner-upload-wrap");
  const input = qsel("event-banner-input");
  const btn = qsel("event-banner-upload-btn");
  const msg = qsel("event-banner-upload-msg");

  const me = JSON.parse(localStorage.getItem("community_user") || "{}");
  const canUpload = me.role === "HOST" || me.role === "ADMIN";

  if (!wrap || !btn || !input) return;
  if (!canUpload) return;

  wrap.classList.remove("hidden");

  btn.addEventListener("click", async () => {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];

    const formData = new FormData();
    formData.append("banner", file);

    btn.disabled = true;
    msg.textContent = "Uploading...";

    try {
      const token = localStorage.getItem("community_token");
      const resp = await axios.post(`/events/${eventId}/banner`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      const url = resp?.data?.bannerUrl;
      msg.textContent = "Banner updated.";

      if (url) {
        const banner = qsel("event-banner");
        banner.innerHTML = "";
        const img = document.createElement("img");
        img.src = url;
        img.className = "w-full h-full object-cover";
        banner.appendChild(img);
      }
    } catch (err) {
      console.error("Banner upload failed", err);
      msg.textContent =
        err?.response?.data?.message || "Failed to upload banner.";
    } finally {
      btn.disabled = false;
    }
  });
}

function showBookingSection() {
  qsel("event-booking-section")?.classList.remove("hidden");
}

function hideBookingSection() {
  qsel("event-booking-section")?.classList.add("hidden");
}

function showListView() {
  qsel("events-list-view")?.classList.remove("hidden");
  qsel("event-detail-view")?.classList.add("hidden");
  qsel("event-booking-section")?.classList.add("hidden");
}

function showDetailView() {
  qsel("events-list-view")?.classList.add("hidden");
  qsel("event-detail-view")?.classList.remove("hidden");
  qsel("event-booking-section")?.classList.remove("hidden");
}

/* ======================================================
   🟢 NEW: ALL EVENTS MODE (event.html without id)
   ====================================================== */

async function loadAllEvents() {
  const loading = qsel("event-loading");
  const card = qsel("event-card");
  const grid = qsel("events-grid");

  hideBookingSection();

  if (!grid) {
    showError("Events grid not found in HTML.");
    return;
  }

  loading?.classList.remove("hidden");
  card?.classList.add("hidden");
  grid.innerHTML = "";

  try {
    const res = await axios.get("/events", { params: { limit: 100 } });
    const events = res.data?.events || res.data?.data || [];

    if (!events.length) {
      grid.innerHTML =
        '<p class="text-sm text-slate-500">No events available.</p>';
      return;
    }

    events.forEach((ev) => {
      const div = document.createElement("div");
      div.className =
        "border rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition bg-white";

      div.innerHTML = `
        <div class="h-40 bg-slate-100">
          ${
            ev.bannerUrl
              ? `<img src="${ev.bannerUrl}" class="w-full h-full object-cover" />`
              : ""
          }
        </div>
        <div class="p-3">
          <div class="font-semibold text-sm">${ev.title}</div>
          <div class="text-xs text-slate-500 mt-1">
            ${ev.city || "Online"} · ${new Date(
        ev.startTime
      ).toLocaleDateString()}
          </div>
          <div class="text-xs font-medium mt-1">
            ${ev.basePrice ? `₹${ev.basePrice}` : "Free"}
          </div>
        </div>
      `;

      div.addEventListener("click", () => {
        window.location.href = `event.html?id=${ev.id}`;
      });

      grid.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    showError("Failed to load events.");
  } finally {
    loading?.classList.add("hidden");
  }
}

/* ======================================================
   🔵 EXISTING: SINGLE EVENT MODE (UNCHANGED)
   ====================================================== */

async function loadEvent() {
  const id = getParam("id");

  // 👉 LIST MODE
  if (!id) {
    showListView();
    await loadAllEvents();
    return;
  }

  // 👉 DETAIL MODE
  showDetailView();
  hideError();

  try {
    const res = await axios.get(`/events/${id}`);
    const event = res?.data?.event || res?.data;
    if (!event) throw new Error("Event not found");

    CURRENT_EVENT = event;

    showBookingSection();

    qsel("event-title").textContent = event.title || "Untitled";

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

    const banner = qsel("event-banner");
    banner.innerHTML = "";
    if (event.bannerUrl) {
      const img = document.createElement("img");
      img.src = event.bannerUrl;
      img.className = "w-full h-full object-cover";
      banner.appendChild(img);
    }

    updateSeatsDisplay(event.seatsLeft ?? event.maxSeats ?? "—");

    let ticketTypes = [];
    try {
      const tResp = await axios.get(`/events/${id}/tickets`);
      ticketTypes = tResp?.data?.tickets || [];
    } catch {
      ticketTypes = [
        {
          id: "default",
          name: "Regular",
          price: event.basePrice || 0,
          remaining: event.maxSeats || null,
        },
      ];
    }

    renderTicketTypes(ticketTypes);

    qsel("event-card")?.classList.remove("hidden");
    qsel("event-loading")?.classList.add("hidden");

    startSeatsLive(id);
    setupChat(id);
    setupEventBannerUpload(id);
  } catch (err) {
    console.error(err);
    showError("Failed to load event.");
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
    socket.on("chat_message", (msg) => {
      // use smart-enabled append
      appendChatMessageWithSmart(msg);
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

// ---------- Booking flow (unchanged) ----------
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
        "Payment order created. Complete payment to confirm booking.";
    }
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

// ---------- Chat helpers & AI ----------

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

function addSmartReplyButtonToMessageEvent(domMessageEl, msgText) {
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
        qsel("chat-input").value = rep;
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

function appendChatMessageWithSmart(msg) {
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
                  <div class="chat-text">${msg.text}</div>`;
  box.appendChild(el);

  // add smart reply button for messages not from current user
  const me = JSON.parse(localStorage.getItem("community_user") || "{}");
  if (
    (msg.senderId && String(msg.senderId) !== String(me.id)) ||
    !msg.senderId
  ) {
    addSmartReplyButtonToMessageEvent(el, msg.text);
  }

  box.scrollTop = box.scrollHeight;
}

// ---------- AI predictive typing UI for event chat ----------

function showPredictiveSuggestions(items) {
  const container = qsel("chat-ai-suggestions");
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
      const input = qsel("chat-input");
      if (!input) return;
      input.value = input.value ? input.value + " " + it : it;
      input.focus();
      container.classList.add("hidden");
    });
    container.appendChild(btn);
  });
}

const predictiveDebounced = debounce(async (text) => {
  if (!text || text.trim().length < 2) {
    showPredictiveSuggestions([]);
    return;
  }
  const suggestions = await fetchAiPredictive(text.trim());
  showPredictiveSuggestions(suggestions.slice(0, 5));
}, 350);

function attachPredictiveTypingToChat() {
  const input = qsel("chat-input");
  if (!input) return;
  input.addEventListener("input", (ev) => {
    predictiveDebounced(ev.target.value);
  });
}

// ensure setupChat attaches it
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

  // typing indicator emit
  input?.addEventListener("input", () => {
    if (socket && socket.connected)
      socket.emit("typing", {
        eventId,
        user:
          JSON.parse(localStorage.getItem("community_user") || "{}").name ||
          "Someone",
      });
  });

  // attach predictive typing
  attachPredictiveTypingToChat();
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  qsel("book-now-btn")?.addEventListener("click", bookNow);
  qsel("open-chat-btn")?.addEventListener("click", () => {
    qsel("chat-widget")?.classList.toggle("hidden");
  });

  loadEvent();
});
