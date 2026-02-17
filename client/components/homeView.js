export function renderHome({ onLogin, onRegister, onStart }) {
  const wrapper = document.createElement("div");
  wrapper.className = "landing";
  wrapper.innerHTML = `
    <div class="landing-inner">
      <span class="tag">Образовательная платформа</span>
      <h1 class="landing-title">Bukva YOU</h1>
      <p class="landing-subtitle">Английский нам не ерунда, это база на года</p>
      <div class="landing-actions">
        <button class="button" id="login">Login</button>
        <button class="button secondary" id="register">Register</button>
      </div>
      <div class="landing-note" id="note"></div>
    </div>
  `;

  const note = wrapper.querySelector("#note");

  wrapper.querySelector("#login").addEventListener("click", () => {
    onLogin();
  });

  wrapper.querySelector("#register").addEventListener("click", () => {
    note.textContent = "Регистрация в MVP пока не подключена. Используйте тестовый вход.";
    note.className = "notice";
    onRegister?.();
  });

  if (onStart) {
    wrapper.querySelector("#start")?.addEventListener("click", () => {
      onStart();
    });
  }

  return wrapper;
}
