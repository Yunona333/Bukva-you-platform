import { renderLogin } from "./components/loginForm.js";
import { renderRegister } from "./components/registerForm.js";
import { renderStudentView } from "./components/studentView.js";
import { renderTeacherView } from "./components/teacherView.js";
import { renderHome } from "./components/homeView.js";
import { api } from "./components/services.js";

const app = document.getElementById("app");

function renderShell(content) {
  app.innerHTML = "";
  const header = document.createElement("header");
  header.innerHTML = `
    <h1>Bukva YOU</h1>
    <button class="button secondary" id="logout">Log out</button>
  `;
  const main = document.createElement("main");
  main.appendChild(content);
  app.appendChild(header);
  app.appendChild(main);

  const logoutBtn = header.querySelector("#logout");
  logoutBtn.addEventListener("click", () => {
    api.logout();
    renderApp();
  });
}

function showLogin() {
  app.innerHTML = "";
  app.appendChild(renderLogin(renderApp));
}

function showRegister() {
  app.innerHTML = "";
  app.appendChild(renderRegister(showLogin, showLogin));
}

function showHome() {
  app.innerHTML = "";
  app.appendChild(
    renderHome({
      onLogin: showLogin,
      onRegister: showRegister
    })
  );
}

async function renderApp() {
  app.innerHTML = "";
  const token = api.getToken();
  if (!token) {
    showHome();
    return;
  }

  const user = await api.getCurrentUser();
  if (!user) {
    api.logout();
    showHome();
    return;
  }

  if (user.role === "student") {
    renderShell(renderStudentView(user));
  } else {
    renderShell(renderTeacherView(user));
  }
}

renderApp();
