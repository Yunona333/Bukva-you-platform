import { api } from "./services.js";

export function renderLogin(onSuccess) {
  const wrapper = document.createElement("div");
  wrapper.className = "card";
  wrapper.innerHTML = `
    <h2>Вход</h2>
    <p class="tag">Student: student@example.com / student123</p>
    <p class="tag">Teacher: admin@example.com / admin123</p>
    <input class="input" type="email" placeholder="Email" id="email" />
    <input class="input" type="password" placeholder="Пароль" id="password" />
    <button class="button" id="login">Войти</button>
    <div id="message"></div>
  `;

  const emailInput = wrapper.querySelector("#email");
  const passwordInput = wrapper.querySelector("#password");
  const message = wrapper.querySelector("#message");

  wrapper.querySelector("#login").addEventListener("click", async () => {
    message.textContent = "";
    message.className = "";
    try {
      await api.login(emailInput.value.trim(), passwordInput.value.trim());
      onSuccess();
    } catch (err) {
      message.textContent = err.message;
      message.className = "notice error";
    }
  });

  return wrapper;
}
