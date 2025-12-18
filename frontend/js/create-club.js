// frontend/js/create-club.js

if (window.axios) {
  axios.defaults.baseURL = "http://localhost:5000";
  axios.defaults.headers["Content-Type"] = "application/json";
}

const token = localStorage.getItem("community_token");
if (!token) {
  alert("Please login first");
  window.location.href = "auth.html#login";
}

axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

function q(id) {
  return document.getElementById(id);
}

function showError(msg) {
  const el = q("form-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}

function hideError() {
  q("form-error").classList.add("hidden");
}

const isPaidCheckbox = q("isPaidMembership");
const feeWrap = q("membership-fee-wrap");

isPaidCheckbox.addEventListener("change", () => {
  feeWrap.classList.toggle("hidden", !isPaidCheckbox.checked);
});

q("create-club-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const payload = {
    name: q("name").value.trim(),
    description: q("description").value.trim() || null,
    category: q("category").value.trim() || null,
    city: q("city").value.trim() || null,
    lat: q("lat").value ? Number(q("lat").value) : null,
    lng: q("lng").value ? Number(q("lng").value) : null,
    bannerUrl: q("bannerUrl").value.trim() || null,
    slug: q("slug").value.trim() || null,
    isPaidMembership: isPaidCheckbox.checked,
    membershipFee: isPaidCheckbox.checked
      ? Number(q("membershipFee").value || 0)
      : null,
  };

  if (!payload.name) {
    showError("Club name is required");
    return;
  }

  if (
    payload.isPaidMembership &&
    (!payload.membershipFee || payload.membershipFee <= 0)
  ) {
    showError("Membership fee must be greater than 0");
    return;
  }

  const btn = q("submit-btn");
  btn.disabled = true;
  btn.textContent = "Creating...";

  try {
    const res = await axios.post("/clubs", payload);
    const club = res.data?.club;

    alert("🎉 Club created successfully!");
    window.location.href = `clubs.html?slug=${club.slug}`;
  } catch (err) {
    console.error(err);
    showError(
      err?.response?.data?.message || "Failed to create club. Try again."
    );
  } finally {
    btn.disabled = false;
    btn.textContent = "Create Club";
  }
});
