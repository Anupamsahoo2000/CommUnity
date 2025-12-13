// frontend/js/auth.js
document.addEventListener("DOMContentLoaded", () => {
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const authTitle = document.getElementById("auth-title");
  const authSubtitle = document.getElementById("auth-subtitle");
  const alertBox = document.getElementById("auth-alert");

  if (window.axios) {
    axios.defaults.baseURL = "http://localhost:5000";
    axios.defaults.headers["Content-Type"] = "application/json";
  }

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

  function switchToLogin() {
    if (!tabLogin || !tabRegister || !loginForm || !registerForm) return;
    tabLogin.className =
      "px-3 py-1.5 rounded-full bg-white shadow text-primary-700 font-medium";
    tabRegister.className =
      "px-3 py-1.5 rounded-full text-slate-500 hover:text-primary-600";

    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");

    if (authTitle) authTitle.textContent = "Login";
    if (authSubtitle)
      authSubtitle.textContent = "Welcome back! Sign in to continue.";

    clearAlert();
  }

  function switchToRegister() {
    if (!tabLogin || !tabRegister || !loginForm || !registerForm) return;
    tabRegister.className =
      "px-3 py-1.5 rounded-full bg-white shadow text-primary-700 font-medium";
    tabLogin.className =
      "px-3 py-1.5 rounded-full text-slate-500 hover:text-primary-600";

    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");

    if (authTitle) authTitle.textContent = "Create account";
    if (authSubtitle)
      authSubtitle.textContent =
        "Join clubs, host events, and book experiences.";
    clearAlert();
  }

  // Tab events
  if (tabLogin) tabLogin.addEventListener("click", switchToLogin);
  if (tabRegister) tabRegister.addEventListener("click", switchToRegister);

  // Open correct tab based on hash
  if (window.location.hash === "#register") {
    switchToRegister();
  } else {
    switchToLogin();
  }

  // Utility for storing auth and attaching header immediately
  function setAuthAndAttach(token, user) {
    saveAuth(token, user);
    if (window.axios) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
  }
  function redirectByRole(user) {
    if (!user || !user.role) {
      window.location.href = "index.html";
      return;
    }

    if (user.role === "HOST") {
      window.location.href = "host-dashboard.html";
    } else {
      window.location.href = "index.html";
    }
  }

  // Login submit
  if (loginForm) {
    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");
    const submitBtn = document.getElementById("login-submit");

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearAlert();

      if (!emailInput || !passwordInput || !submitBtn) return;

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        showAlert("error", "Please provide both email and password.");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Logging in...";

      try {
        const res = await axios.post("/auth/login", { email, password });

        const { user, token } = res.data || {};
        if (!token) {
          showAlert("error", "No token received from server.");
        } else {
          // Save auth in localStorage and attach header for immediate API usage
          setAuthAndAttach(token, user);

          showAlert("success", "Login successful! Redirecting...");

          setTimeout(() => {
            redirectByRole(user);
          }, 600);
        }
      } catch (err) {
        console.error(err);
        const msg =
          err?.response?.data?.message ||
          "Login failed. Please check your credentials.";
        showAlert("error", msg);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Login";
      }
    });
  }

  // Register submit
  if (registerForm) {
    const nameInput = document.getElementById("register-name");
    const emailInput = document.getElementById("register-email");
    const passwordInput = document.getElementById("register-password");
    const cityInput = document.getElementById("register-city");
    const latInput = document.getElementById("register-lat");
    const lngInput = document.getElementById("register-lng");
    const roleSelect = document.getElementById("register-role");
    const submitBtn = document.getElementById("register-submit");

    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearAlert();

      if (
        !nameInput ||
        !emailInput ||
        !passwordInput ||
        !submitBtn ||
        !roleSelect
      )
        return;

      const payload = {
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        password: passwordInput.value,
        role: roleSelect.value || "USER",
        city: cityInput?.value.trim() || undefined,
        lat: latInput?.value ? Number(latInput.value) : undefined,
        lng: lngInput?.value ? Number(lngInput.value) : undefined,
      };

      if (!payload.name || !payload.email || !payload.password) {
        showAlert("error", "Name, email and password are required.");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Creating account...";

      try {
        const res = await axios.post("/auth/register", payload);
        const { user, token } = res.data || {};

        if (!token) {
          showAlert("error", "No token received from server.");
        } else {
          setAuthAndAttach(token, user);
          showAlert("success", "Account created! Redirecting to dashboard...");
          setTimeout(() => {
            redirectByRole(user);
          }, 600);
        }
      } catch (err) {
        console.error(err);
        const msg =
          err?.response?.data?.message ||
          "Registration failed. Please try again.";
        showAlert("error", msg);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Create account";
      }
    });
  }
});
