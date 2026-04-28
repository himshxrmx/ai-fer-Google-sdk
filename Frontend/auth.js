document.addEventListener("DOMContentLoaded", function () {

  let isLogin = true;

  const form = document.getElementById("authForm");
  const title = document.getElementById("formTitle");
  const subtitle = document.getElementById("formSubtitle");
  const button = document.getElementById("submitBtn");
  const toggleText = document.querySelector(".toggle-text");

  // 🔥 Prevent Reload
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (!email || !password) {
      alert("Please fill all fields");
      return;
    }

    console.log("Login attempt:", email, password);

    // Temporary success redirect
    window.location.href = "home.html";
  });

  // Toggle Login / Signup
  window.toggleForm = function () {
    isLogin = !isLogin;

    if (!isLogin) {
      title.innerText = "Create Account";
      subtitle.innerText = "Sign up to get started";
      button.innerText = "SIGN UP";
      toggleText.innerHTML =
        `Already have an account? <span onclick="toggleForm()">Sign In</span>`;
    } else {
      title.innerText = "Welcome Back";
      subtitle.innerText = "Sign in to continue your journey";
      button.innerText = "SIGN IN";
      toggleText.innerHTML =
        `Don't have an account? <span onclick="toggleForm()">Sign Up</span>`;
    }
  };

});
const authForm = document.getElementById("authForm");

authForm.addEventListener("submit", function (e) {
  e.preventDefault(); // ❗ Prevent page reload

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  // Simple validation (you can connect real auth later)
  if (email && password) {
    // Redirect to home page
    window.location.href = "home.html";
  } else {
    alert("Please enter email and password");
  }
});

