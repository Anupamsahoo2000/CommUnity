// js/index.js

// ---------- Axios base config ----------
if (window.axios) {
  axios.defaults.baseURL = "http://localhost:5000"; // same server as backend
  axios.defaults.headers["Content-Type"] = "application/json";
}

// ---------- Simple auth helpers ----------
const STORAGE_TOKEN_KEY = "community_token";
const STORAGE_USER_KEY = "community_user";

function saveAuth(token, user) {
  if (!token) return;
  localStorage.setItem(STORAGE_TOKEN_KEY, token);
  if (user) {
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
  }
}

function getToken() {
  return localStorage.getItem(STORAGE_TOKEN_KEY);
}

function getStoredUser() {
  const raw = localStorage.getItem(STORAGE_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearAuth() {
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_USER_KEY);
}

// Attach auth header helper
function authConfig(extra = {}) {
  const token = getToken();
  const headers = extra.headers || {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return { ...extra, headers };
}

// ---------- Navbar setup ----------
function setupNavbar() {
  const loginBtn = document.getElementById("nav-login-btn");
  const registerBtn = document.getElementById("nav-register-btn");
  const userMenu = document.getElementById("nav-user-menu");
  const userButton = document.getElementById("nav-user-button");
  const userDropdown = document.getElementById("nav-user-dropdown");
  const userAvatar = document.getElementById("nav-user-avatar");
  const userNameSpan = document.getElementById("nav-user-name");
  const logoutBtn = document.getElementById("nav-logout-btn");

  const token = getToken && getToken();
  const user = getStoredUser && getStoredUser();

  // Hide login/register if logged in
  if (token && user) {
    if (loginBtn) {
      loginBtn.classList.add("hidden");
      loginBtn.style.display = "none";
    }
    if (registerBtn) {
      registerBtn.classList.add("hidden");
      registerBtn.style.display = "none";
    }

    if (userMenu) {
      userMenu.classList.remove("hidden");

      const displayName = user.name || user.email || "User";
      if (userNameSpan) userNameSpan.textContent = displayName;
      if (userAvatar) {
        const initial = displayName.trim().charAt(0).toUpperCase();
        userAvatar.textContent = initial || "U";
      }
    }
  }

  // Dropdown toggle
  if (userButton && userDropdown && userMenu) {
    userButton.addEventListener("click", () => {
      userDropdown.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!userMenu.contains(e.target)) {
        userDropdown.classList.add("hidden");
      }
    });
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearAuth && clearAuth();
      window.location.href = "index.html";
    });
  }
}

// ---------- Hero / location ----------
function setupLocationControls() {
  const locationInput = document.getElementById("location-input");
  const useLocationBtn = document.getElementById("use-location-btn");

  if (!locationInput || !useLocationBtn) return;

  useLocationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported in this browser.");
      return;
    }

    useLocationBtn.disabled = true;
    useLocationBtn.textContent = "Detecting...";

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        locationInput.value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        useLocationBtn.disabled = false;
        useLocationBtn.textContent = "Use my location";
      },
      () => {
        alert("Unable to fetch location.");
        useLocationBtn.disabled = false;
        useLocationBtn.textContent = "Use my location";
      }
    );
  });
}

// ---------- Render events from API ----------
function renderEvents(events) {
  const grid = document.getElementById("events-grid");
  const countSpan = document.getElementById("events-count");
  const emptyState = document.getElementById("events-empty");

  if (!grid || !countSpan || !emptyState) return;

  grid.innerHTML = "";

  if (!events || !events.length) {
    emptyState.classList.remove("hidden");
    countSpan.textContent = "0";
    return;
  }

  emptyState.classList.add("hidden");
  countSpan.textContent = String(events.length);

  events.forEach((ev) => {
    const card = document.createElement("article");
    card.className =
      "bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col hover:shadow-md transition";

    // derive fields from backend event model
    const banner =
      ev.bannerUrl ||
      "https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg?auto=compress&cs=tinysrgb&w=800";

    const city = ev.city || "Online";
    const category = ev.category || "Events";

    let dateStr = "Date TBA";
    let timeStr = "";
    if (ev.startTime) {
      const d = new Date(ev.startTime);
      dateStr = d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      timeStr = d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const isFree =
      ev.isFree === true || Number(ev.basePrice || 0) === 0 || !ev.basePrice;
    const priceType = isFree ? "FREE" : "PAID";
    const price = Number(ev.basePrice || 0);

    const tag =
      ev.status === "PUBLISHED"
        ? "Available"
        : ev.status === "DRAFT"
        ? "Draft"
        : "Upcoming";

    card.innerHTML = `
      <div class="h-36 w-full overflow-hidden">
        <img
          src="${banner}"
          alt="${ev.title || "Event"}"
          class="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div class="flex-1 flex flex-col p-3.5">
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <p class="text-[11px] font-medium text-primary-600">
            ${dateStr}${timeStr ? " · " + timeStr : ""}
          </p>
          <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">
            ${tag}
          </span>
        </div>
        <h3 class="text-sm font-semibold text-slate-900 line-clamp-2 mb-1">
          ${ev.title || "Event"}
        </h3>
        <p class="text-[11px] text-slate-500 mb-2">
          ${city} · ${category}
        </p>
        <div class="mt-auto flex items-center justify-between pt-2 border-t border-slate-100">
          <div class="flex flex-col">
            ${
              isFree
                ? `<span class="text-xs font-semibold text-emerald-600">Free</span>`
                : `<span class="text-xs font-semibold text-slate-900">₹${price.toFixed(
                    0
                  )}</span>`
            }
            <span class="text-[10px] text-slate-400">${
              isFree ? "Limited spots" : "Per person"
            }</span>
          </div>
          <button
            class="text-[11px] font-medium px-3 py-1.5 rounded-full bg-primary-600 text-white hover:bg-primary-700 transition"
            data-event-id="${ev.id}"
          >
            View Details
          </button>
        </div>
      </div>
    `;

    // wire up View Details → event.html?id=...
    const btn = card.querySelector("[data-event-id]");
    if (btn) {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-event-id");
        if (id) {
          window.location.href = `event.html?id=${id}`;
        }
      });
    }

    grid.appendChild(card);
  });
}

// ---------- API loading + filters ----------

// in-memory filters state
const filtersState = {
  q: "",
  city: "",
  category: "",
  date: "",
  price: "ANY", // ANY | FREE | PAID
};

async function loadEventsFromApi() {
  const grid = document.getElementById("events-grid");
  const emptyState = document.getElementById("events-empty");
  const countSpan = document.getElementById("events-count");

  if (emptyState) emptyState.classList.add("hidden");
  if (grid)
    grid.innerHTML = `
    <div class="col-span-full text-xs text-slate-500">
      Loading events...
    </div>
  `;
  if (countSpan) countSpan.textContent = "...";

  try {
    const params = {
      limit: 24,
    };

    if (filtersState.q) params.q = filtersState.q;
    if (filtersState.city) params.city = filtersState.city;
    if (filtersState.category) params.category = filtersState.category;
    if (filtersState.date) {
      // same day range
      params.date_from = filtersState.date;
      params.date_to = filtersState.date;
    }

    const res = await axios.get("/events", { params });
    const payload = res.data || {};
    let events = payload.data || payload.events || [];

    // client-side filter by price type
    if (filtersState.price === "FREE") {
      events = events.filter(
        (e) =>
          e.isFree === true || Number(e.basePrice || 0) === 0 || !e.basePrice
      );
    } else if (filtersState.price === "PAID") {
      events = events.filter(
        (e) => e.isFree === false && Number(e.basePrice || 0) > 0
      );
    }

    renderEvents(events);
  } catch (err) {
    console.error("Failed to load events:", err);
    if (grid) {
      grid.innerHTML = `
        <div class="col-span-full text-xs text-red-600">
          Failed to load events. Please try again later.
        </div>
      `;
    }
    if (countSpan) countSpan.textContent = "0";
  }
}

function setupFilters() {
  const searchInput = document.getElementById("nav-search-input");
  const searchForm = document.getElementById("nav-search-form");
  const citySelect = document.getElementById("filter-city");
  const categorySelect = document.getElementById("filter-category");
  const dateInput = document.getElementById("filter-date");
  const radiusInput = document.getElementById("filter-radius");
  const radiusLabel = document.getElementById("filter-radius-label");
  const priceAnyBtn = document.getElementById("filter-price-any");
  const priceFreeBtn = document.getElementById("filter-price-free");
  const pricePaidBtn = document.getElementById("filter-price-paid");
  const resetBtn = document.getElementById("filter-reset");
  const emptyResetBtn = document.getElementById("events-empty-reset");

  if (radiusInput && radiusLabel) {
    radiusInput.addEventListener("input", () => {
      radiusLabel.textContent = `${radiusInput.value} km`;
    });
  }

  function applyFilters() {
    filtersState.q = (searchInput?.value || "").trim();
    filtersState.city = citySelect?.value || "";
    filtersState.category = categorySelect?.value || "";
    filtersState.date = dateInput?.value || "";
    loadEventsFromApi();
  }

  // Search form submit
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      applyFilters();
    });
  }

  // Other filters trigger immediate reload
  [citySelect, categorySelect, dateInput].forEach((el) => {
    if (!el) return;
    el.addEventListener("change", applyFilters);
  });

  // Price toggle buttons
  function setPriceFilter(newFilter) {
    filtersState.price = newFilter;

    if (priceAnyBtn) {
      priceAnyBtn.className =
        "px-3 py-1.5 text-[11px] sm:text-xs font-medium " +
        (filtersState.price === "ANY"
          ? "bg-primary-50 text-primary-700"
          : "text-slate-600 hover:bg-slate-50");
    }
    if (priceFreeBtn) {
      priceFreeBtn.className =
        "px-3 py-1.5 text-[11px] sm:text-xs font-medium " +
        (filtersState.price === "FREE"
          ? "bg-primary-50 text-primary-700"
          : "text-slate-600 hover:bg-slate-50");
    }
    if (pricePaidBtn) {
      pricePaidBtn.className =
        "px-3 py-1.5 text-[11px] sm:text-xs font-medium " +
        (filtersState.price === "PAID"
          ? "bg-primary-50 text-primary-700"
          : "text-slate-600 hover:bg-slate-50");
    }

    loadEventsFromApi();
  }

  if (priceAnyBtn)
    priceAnyBtn.addEventListener("click", () => setPriceFilter("ANY"));
  if (priceFreeBtn)
    priceFreeBtn.addEventListener("click", () => setPriceFilter("FREE"));
  if (pricePaidBtn)
    pricePaidBtn.addEventListener("click", () => setPriceFilter("PAID"));

  // Reset
  function resetFilters() {
    if (searchInput) searchInput.value = "";
    if (citySelect) citySelect.value = "";
    if (categorySelect) categorySelect.value = "";
    if (dateInput) dateInput.value = "";
    if (radiusInput) radiusInput.value = "20";
    if (radiusLabel) radiusLabel.textContent = "20 km";
    filtersState.q = "";
    filtersState.city = "";
    filtersState.category = "";
    filtersState.date = "";
    setPriceFilter("ANY"); // also triggers loadEventsFromApi
  }

  if (resetBtn) resetBtn.addEventListener("click", () => resetFilters());
  if (emptyResetBtn)
    emptyResetBtn.addEventListener("click", () => resetFilters());

  // Initial load from API
  loadEventsFromApi();
}

// ---------- Common footer year ----------
function setupYear() {
  const span = document.getElementById("year-span");
  if (span) {
    span.textContent = String(new Date().getFullYear());
  }
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  setupNavbar();
  setupLocationControls();
  setupFilters();
  setupYear();
});
