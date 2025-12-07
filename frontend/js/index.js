
// ---------- Axios base config ----------
if (window.axios) {
  axios.defaults.baseURL = "http://localhost:5000"; // backend
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

// Attach token to axios if present
(function attachTokenToAxios() {
  const token = getToken();
  if (token) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }
})();

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
      // remove axios header too
      delete axios.defaults.headers.common["Authorization"];
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
        // set the input to lat,lng for clarity but also store last position for radius-based backend queries
        locationInput.value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        window._lastDetectedPosition = { lat: Number(latitude), lng: Number(longitude) };
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

// ---------- Dummy events (fallback) ----------
const dummyEvents = [
  {
    id: 1,
    title: "10K City Marathon",
    city: "Bhubaneswar",
    category: "Fitness",
    startTime: "2025-12-06T06:00:00.000Z",
    priceType: "PAID",
    basePrice: 499,
    tag: "Trending",
    bannerUrl:
      "https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg?auto=compress&cs=tinysrgb&w=800",
    isFree: false,
  },
  {
    id: 2,
    title: "Sunday Cycling Meetup",
    city: "Bangalore",
    category: "Cycling",
    startTime: "2025-12-07T07:00:00.000Z",
    priceType: "FREE",
    basePrice: 0,
    tag: "Limited Seats",
    bannerUrl:
      "https://images.pexels.com/photos/276517/pexels-photo-276517.jpeg?auto=compress&cs=tinysrgb&w=800",
    isFree: true,
  },
  {
    id: 3,
    title: "Full-Stack JS Dev Meetup",
    city: "Hyderabad",
    category: "Tech",
    startTime: "2025-12-10T16:00:00.000Z",
    priceType: "FREE",
    basePrice: 0,
    tag: "Community",
    bannerUrl:
      "https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=800",
    isFree: true,
  },
];

// ---------- Render a single event card (handles backend or dummy shapes) ----------
function renderEventCard(ev) {
  // ev: supports backend fields (id, title, startTime, city, category, isFree, basePrice, bannerUrl, tag)
  const card = document.createElement("article");
  card.className =
    "bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col hover:shadow-md transition";

  const banner = ev.bannerUrl || ev.banner || "";
  const dateStr = ev.startTime ? new Date(ev.startTime).toLocaleDateString() : "";
  const timeStr = ev.startTime ? new Date(ev.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "";
  const priceLabel = ev.isFree || ev.priceType === "FREE" ? "Free" : `₹${ev.basePrice ?? ev.basePrice ?? 0}`;

  card.innerHTML = `
    <div class="h-36 w-full overflow-hidden bg-gray-100">
      ${
        banner
          ? `<img src="${banner}" alt="${ev.title || ''}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-300">`
          : `<div class="w-full h-full flex items-center justify-center text-slate-400">No image</div>`
      }
    </div>
    <div class="flex-1 flex flex-col p-3.5">
      <div class="flex items-center justify-between gap-2 mb-1.5">
        <p class="text-[11px] font-medium text-primary-600">
          ${dateStr} · ${timeStr}
        </p>
        <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">
          ${ev.tag || ev.status || ""}
        </span>
      </div>
      <h3 class="text-sm font-semibold text-slate-900 line-clamp-2 mb-1">
        ${ev.title || "Untitled Event"}
      </h3>
      <p class="text-[11px] text-slate-500 mb-2">
        ${ev.city || ""} · ${ev.category || ""}
      </p>
      <div class="mt-auto flex items-center justify-between pt-2 border-t border-slate-100">
        <div class="flex flex-col">
          ${
            (ev.isFree || ev.priceType === "FREE")
              ? `<span class="text-xs font-semibold text-emerald-600">Free</span>`
              : `<span class="text-xs font-semibold text-slate-900">${priceLabel}</span>`
          }
          <span class="text-[10px] text-slate-400">${(ev.isFree || ev.priceType === "FREE") ? "Limited spots" : "Per person"}</span>
        </div>
        <a href="event.html?id=${ev.id}" class="text-[11px] font-medium px-3 py-1.5 rounded-full bg-primary-600 text-white hover:bg-primary-700 transition">View Details</a>
      </div>
    </div>
  `;
  return card;
}

// ---------- Render array of events ----------
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
    const card = renderEventCard(ev);
    grid.appendChild(card);
  });
}

// ---------- Fetch events from backend (with filters) ----------
async function fetchEventsFromApi(params = {}) {
  // params: q, city, category, date_from, date_to, price, lat, lng, radiusKm, page, limit
  try {
    const resp = await axios.get("/events", { params });
    // Expect { data: [...], meta: {...} }
    if (resp?.data?.data) {
      return { ok: true, data: resp.data.data, meta: resp.data.meta || {} };
    }
    return { ok: true, data: resp.data || [], meta: {} };
  } catch (err) {
    console.warn("fetchEventsFromApi failed:", err?.response?.data || err.message || err);
    return { ok: false, error: err };
  }
}

// ---------- Collect filters from UI ----------
function collectFiltersForBackend() {
  const q = (document.getElementById("nav-search-input")?.value || "").trim();
  const city = document.getElementById("filter-city")?.value || "";
  const category = document.getElementById("filter-category")?.value || "";
  const date = document.getElementById("filter-date")?.value || "";
  const radius = document.getElementById("filter-radius")?.value || "";
  const priceAny = document.getElementById("filter-price-any");
  const priceFree = document.getElementById("filter-price-free");
  const pricePaid = document.getElementById("filter-price-paid");

  let price = undefined;
  if (priceFree && priceFree.classList.contains("bg-primary-50")) price = "FREE";
  if (pricePaid && pricePaid.classList.contains("bg-primary-50")) price = "PAID";

  const params = {};
  if (q) params.q = q;
  if (city) params.city = city;
  if (category) params.category = category;
  if (date) params.date_from = date; // backend supports date_from / date_to
  if (date) params.date_to = date;
  if (price) params.price = price;

  if (radius) {
    const num = Number(radius);
    if (!Number.isNaN(num) && num > 0) {
      params.radiusKm = num;
      // attach last detected geo if available
      if (window._lastDetectedPosition && window._lastDetectedPosition.lat && window._lastDetectedPosition.lng) {
        params.lat = window._lastDetectedPosition.lat;
        params.lng = window._lastDetectedPosition.lng;
      }
    }
  }

  return params;
}

// ---------- Wiring filters UI to fetching ----------
function setupFilters() {
  const searchForm = document.getElementById("nav-search-form");
  const searchInput = document.getElementById("nav-search-input");
  const citySelect = document.getElementById("filter-city");
  const categorySelect = document.getElementById("filter-category");
  const dateInput = document.getElementById("filter-date");
  const radiusInput = document.getElementById("filter-radius");
  const priceAnyBtn = document.getElementById("filter-price-any");
  const priceFreeBtn = document.getElementById("filter-price-free");
  const pricePaidBtn = document.getElementById("filter-price-paid");
  const resetBtn = document.getElementById("filter-reset");
  const emptyResetBtn = document.getElementById("events-empty-reset");

  // Keep a simple state to track which price is active by toggling classes exactly like your UI expects.
  function setPriceState(state) {
    // state: "ANY" | "FREE" | "PAID"
    const mapToClasses = (active) =>
      active
        ? "px-3 py-1.5 text-[11px] sm:text-xs font-medium bg-primary-50 text-primary-700"
        : "px-3 py-1.5 text-[11px] sm:text-xs font-medium text-slate-600 hover:bg-slate-50";

    if (priceAnyBtn) priceAnyBtn.className = mapToClasses(state === "ANY");
    if (priceFreeBtn) priceFreeBtn.className = mapToClasses(state === "FREE");
    if (pricePaidBtn) pricePaidBtn.className = mapToClasses(state === "PAID");
  }

  // Event that triggers fetch
  async function applyAndFetch() {
    const params = collectFiltersForBackend();
    // page/limit can be added if you implement pagination server-side
    const result = await fetchEventsFromApi(params);
    if (result.ok) {
      renderEvents(result.data);
    } else {
      // fallback to dummy
      renderEvents(dummyEvents);
    }
  }

  // Search submit
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      applyAndFetch();
    });
  }

  // quick apply when pressing Enter in the big hero search (if exists)
  const heroSearch = document.getElementById("location-input");
  if (heroSearch) {
    heroSearch.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyAndFetch();
      }
    });
  }

  // on change handlers
  [citySelect, categorySelect, dateInput].forEach((el) => {
    if (!el) return;
    el.addEventListener("change", applyAndFetch);
  });

  if (radiusInput) {
    radiusInput.addEventListener("input", () => {
      const label = document.getElementById("filter-radius-label");
      if (label) label.textContent = `${radiusInput.value} km`;
    });
    radiusInput.addEventListener("change", applyAndFetch);
  }

  if (priceAnyBtn) priceAnyBtn.addEventListener("click", () => { setPriceState("ANY"); applyAndFetch(); });
  if (priceFreeBtn) priceFreeBtn.addEventListener("click", () => { setPriceState("FREE"); applyAndFetch(); });
  if (pricePaidBtn) pricePaidBtn.addEventListener("click", () => { setPriceState("PAID"); applyAndFetch(); });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (citySelect) citySelect.value = "";
      if (categorySelect) categorySelect.value = "";
      if (dateInput) dateInput.value = "";
      if (radiusInput) radiusInput.value = "20";
      setPriceState("ANY");
      renderEvents(dummyEvents);
    });
  }

  if (emptyResetBtn) {
    emptyResetBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (citySelect) citySelect.value = "";
      if (categorySelect) categorySelect.value = "";
      if (dateInput) dateInput.value = "";
      if (radiusInput) radiusInput.value = "20";
      setPriceState("ANY");
      renderEvents(dummyEvents);
    });
  }

  // initial apply
  setPriceState("ANY");
  // Try an initial backend fetch, fallback to dummy
  applyAndFetch();
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
