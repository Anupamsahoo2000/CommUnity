// js/dashboard.js

// ---------- Axios defaults ----------
if (window.axios) {
  axios.defaults.baseURL = "http://localhost:5000";
  axios.defaults.headers["Content-Type"] = "application/json";
}

// ---------- Utility / DOM helpers ----------
function getTokenFromLS() {
  return getToken?.() || localStorage.getItem("community_token");
}

// ---------- Booking cards renderer (used by loadMyBookings) ----------
function renderBookingCard(b) {
  // b: { id, event: { id, title, bannerUrl, startTime }, ticketType, quantity, status, qrUrl }
  const wrapper = document.createElement("div");
  wrapper.className =
    "bg-white rounded-2xl p-3 border border-slate-100 flex items-center gap-3";
  wrapper.innerHTML = `
    <img src="${
      b.event?.bannerUrl || "https://via.placeholder.com/96"
    }" alt="" class="h-16 w-24 object-cover rounded-md" />
    <div class="flex-1">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-sm font-semibold">${b.event?.title || "Event"}</div>
          <div class="text-xs text-slate-500">${
            b.ticketType || ""
          } · ${new Date(
    b.event?.startTime || Date.now()
  ).toLocaleString()}</div>
        </div>
        <div class="text-right text-sm">
          <div class="${
            b.status === "CONFIRMED" ? "text-emerald-600" : "text-slate-600"
          } font-medium">${b.status}</div>
          <div class="text-xs text-slate-500">${b.quantity} tickets</div>
        </div>
      </div>
      <div class="mt-2 flex gap-2">
        <a href="event.html?id=${
          b.event?.id
        }" class="px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 text-xs">View Event</a>
        ${
          b.qrUrl
            ? `<a href="${b.qrUrl}" target="_blank" class="px-3 py-1.5 rounded-full border text-xs">Download QR</a>`
            : ""
        }
        ${
          b.status === "CONFIRMED"
            ? `<button data-id="${b.id}" class="btn-cancel px-3 py-1.5 rounded-full border text-xs text-red-600">Cancel</button>`
            : ""
        }
      </div>
    </div>
  `;
  return wrapper;
}

async function loadMyBookings() {
  const token = getTokenFromLS();
  const list = document.getElementById("bookings-list");
  const empty = document.getElementById("bookings-empty");

  if (!list || !empty) return;

  if (!token) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  try {
    const r = await axios.get("/api/bookings/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const bookings = r?.data?.data || r?.data || [];
    list.innerHTML = "";

    if (!bookings.length) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    bookings.forEach((b) => {
      const card = renderBookingCard(b);
      list.appendChild(card);
    });

    // attach cancel handlers
    document.querySelectorAll(".btn-cancel").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!confirm("Cancel this booking?")) return;
        try {
          await axios.post(
            `/api/bookings/${id}/cancel`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          alert("Booking cancellation requested.");
          // reload bookings
          loadMyBookings();
        } catch (err) {
          alert(err?.response?.data?.message || "Failed to cancel booking.");
        }
      });
    });
  } catch (err) {
    console.error("Failed to load bookings", err);
    list.innerHTML = "";
    empty.classList.remove("hidden");
  }
}

// ---------- Main DOMContentLoaded flow ----------
document.addEventListener("DOMContentLoaded", async () => {
  const alertBox = document.getElementById("dash-alert");
  const logoutBtn = document.getElementById("dash-logout-btn");

  const fieldName = document.getElementById("dash-field-name");
  const fieldEmail = document.getElementById("dash-field-email");
  const fieldRole = document.getElementById("dash-field-role");
  const fieldCity = document.getElementById("dash-field-city");
  const fieldLat = document.getElementById("dash-field-lat");
  const fieldLng = document.getElementById("dash-field-lng");

  const avatar = document.getElementById("dash-user-avatar");
  const nameSpan = document.getElementById("dash-user-name");
  const roleSpan = document.getElementById("dash-user-role");

  function showAlert(type, message) {
    if (!alertBox) return;
    alertBox.classList.remove("hidden");
    alertBox.textContent = message;

    if (type === "error") {
      alertBox.className =
        "mb-3 text-xs rounded-md px-3 py-2 bg-red-50 text-red-700 border border-red-100";
    } else if (type === "success") {
      alertBox.className =
        "mb-3 text-xs rounded-md px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100";
    }
  }

  function clearAlert() {
    if (!alertBox) return;
    alertBox.classList.add("hidden");
    alertBox.textContent = "";
  }

  // Protect route: if no token → redirect to auth
  const token = getTokenFromLS();
  if (!token) {
    window.location.href = "auth.html#login";
    return;
  }

  // Attach token to axios headers for this page
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearAuth?.();
      // remove axios header
      delete axios.defaults.headers.common["Authorization"];
      window.location.href = "index.html";
    });
  }

  try {
    clearAlert();

    const res = await axios.get("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const { user } = res.data || {};

    if (!user) {
      showAlert("error", "Could not load user profile.");
      return;
    }

    // Fill DB-backed profile
    if (fieldName) fieldName.textContent = user.name || "—";
    if (fieldEmail) fieldEmail.textContent = user.email || "—";
    if (fieldRole) fieldRole.textContent = user.role || "—";
    if (fieldCity) fieldCity.textContent = user.city || "—";
    if (fieldLat) fieldLat.textContent = user.lat ?? "—";
    if (fieldLng) fieldLng.textContent = user.lng ?? "—";

    // Top avatar + texts
    const displayName = user.name || user.email || "User";
    if (nameSpan) nameSpan.textContent = displayName;
    if (roleSpan) roleSpan.textContent = (user.role || "USER").toUpperCase();
    if (avatar) {
      const initial = displayName.trim().charAt(0).toUpperCase();
      avatar.textContent = initial || "U";
    }

    // Keep LS user in sync
    saveAuth?.(token, user);

    // Load bookings after profile is loaded
    // (only if bookings section exists)
    if (document.getElementById("my-bookings-section")) {
      loadMyBookings();
    }
  } catch (err) {
    console.error(err);
    const status = err?.response?.status;
    if (status === 401) {
      // Token invalid / expired
      clearAuth?.();
      window.location.href = "auth.html#login";
      return;
    }
    const msg =
      err?.response?.data?.message ||
      "Something went wrong while loading your profile.";
    showAlert("error", msg);
  }

  // ---------------- Create Event handler (with show/hide toggle) ----------------
  const createSectionToggleBtn = document.getElementById(
    "create-event-toggle-btn"
  );
  const createFormWrap = document.getElementById("create-event-form-wrap");
  const createForm = document.getElementById("create-event-form");

  // Show form when toggle button clicked
  if (createSectionToggleBtn && createFormWrap) {
    createSectionToggleBtn.addEventListener("click", () => {
      if (createFormWrap.classList.contains("hidden")) {
        createFormWrap.classList.remove("hidden");
        setTimeout(
          () =>
            createFormWrap.scrollIntoView({
              behavior: "smooth",
              block: "center",
            }),
          50
        );
      } else {
        createFormWrap.classList.add("hidden");
      }
    });
  }

  // Cancel button inside form — hide form
  const cancelBtn = document.getElementById("evt-cancel-btn");
  if (cancelBtn && createFormWrap) {
    cancelBtn.addEventListener("click", () => {
      createFormWrap.classList.add("hidden");
    });
  }

  // Existing create handler (uses same IDs you've already wired)
  if (createForm) {
    const btn = document.getElementById("evt-create-btn");
    const resBox = document.getElementById("evt-create-result");

    btn.addEventListener("click", async () => {
      if (!btn) return;
      btn.disabled = true;
      btn.textContent = "Creating...";

      const title = document.getElementById("evt-title")?.value?.trim();
      const category = document.getElementById("evt-category")?.value;
      const city = document.getElementById("evt-city")?.value?.trim();
      const location = document.getElementById("evt-location")?.value?.trim();
      const startTime = document.getElementById("evt-start")?.value;
      const endTime = document.getElementById("evt-end")?.value;
      const maxSeats = document.getElementById("evt-seats")?.value;
      const price = document.getElementById("evt-price")?.value;
      const description = document.getElementById("evt-desc")?.value;
      const publish = document.getElementById("evt-publish")?.checked;

      // Basic validation
      if (!title || !startTime) {
        resBox.classList.remove("hidden");
        resBox.className = "text-sm text-red-600 mt-2";
        resBox.textContent = "Title and start time are required.";
        btn.disabled = false;
        btn.textContent = "Create Event";
        return;
      }

      const payload = {
        title,
        description: description || undefined,
        category: category || undefined,
        city: city || undefined,
        location: location || undefined,
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
        maxSeats: maxSeats ? Number(maxSeats) : undefined,
        isFree: price === "" || Number(price) === 0,
        basePrice: price ? Number(price) : 0,
        status: publish ? "PUBLISHED" : "DRAFT",
      };

      try {
        const r = await axios.post("/api/events", payload);
        const created = r?.data?.event || r?.data;
        if (created) {
          resBox.classList.remove("hidden");
          resBox.className = "text-sm text-emerald-600 mt-2";
          resBox.textContent = "Event created successfully.";
          // reset form lightly
          createForm.reset();
          // hide the form after creating
          if (createFormWrap) createFormWrap.classList.add("hidden");

          // redirect to event page if id present
          if (created.id) {
            setTimeout(() => {
              window.location.href = `event.html?id=${created.id}`;
            }, 800);
          } else {
            setTimeout(() => window.location.reload(), 800);
          }
        } else {
          throw new Error("Unexpected create response.");
        }
      } catch (err) {
        console.error("Create event failed:", err);
        const msg = err?.response?.data?.message || "Failed to create event.";
        resBox.classList.remove("hidden");
        resBox.className = "text-sm text-red-600 mt-2";
        resBox.textContent = msg;
      } finally {
        btn.disabled = false;
        btn.textContent = "Create Event";
      }
    });
  }
});
