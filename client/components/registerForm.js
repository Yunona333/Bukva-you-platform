import { api } from "./services.js";

const RESERVED = ["admin", "support", "system", "bukvayou", "yunona", "yuna"];

function validateEmail(email) {
  if (!email) return "Некорректный формат email";
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return ok ? "" : "Некорректный формат email";
}

function validateNickname(nickname) {
  if (!nickname) return "Никнейм содержит недопустимые символы или запрещённое слово";
  const lower = nickname.toLowerCase();
  if (RESERVED.includes(lower)) {
    return "Никнейм содержит недопустимые символы или запрещённое слово";
  }
  if (!/^[A-Za-z0-9_]{3,20}$/.test(nickname)) {
    return "Никнейм содержит недопустимые символы или запрещённое слово";
  }
  return "";
}

export function renderRegister(onSuccess, onLogin) {
  const wrapper = document.createElement("div");
  wrapper.className = "card";
  wrapper.innerHTML = `
    <h2>Регистрация</h2>
    <label class="field">
      <span>Email</span>
      <input class="input" type="email" id="email" />
      <div class="field-error" id="emailError"></div>
    </label>
    <label class="field">
      <span>Password</span>
      <input class="input" type="password" id="password" />
      <div class="field-error" id="passwordError"></div>
    </label>
    <label class="field">
      <span>Confirm Password</span>
      <input class="input" type="password" id="confirm" />
      <div class="field-error" id="confirmError"></div>
    </label>
    <label class="field">
      <span>Nickname</span>
      <input class="input" type="text" id="nickname" />
      <div class="field-error" id="nicknameError"></div>
    </label>
    <button class="button" id="register" disabled>Register</button>
    <p class="link" id="loginLink">Уже есть аккаунт? Войти</p>
    <div id="success"></div>
  `;

  const email = wrapper.querySelector("#email");
  const password = wrapper.querySelector("#password");
  const confirm = wrapper.querySelector("#confirm");
  const nickname = wrapper.querySelector("#nickname");
  const registerBtn = wrapper.querySelector("#register");

  const emailError = wrapper.querySelector("#emailError");
  const passwordError = wrapper.querySelector("#passwordError");
  const confirmError = wrapper.querySelector("#confirmError");
  const nicknameError = wrapper.querySelector("#nicknameError");
  const success = wrapper.querySelector("#success");

  function updateButton() {
    const filled =
      email.value.trim() &&
      password.value.trim() &&
      confirm.value.trim() &&
      nickname.value.trim();
    registerBtn.disabled = !filled;
  }

  function clearErrors() {
    emailError.textContent = "";
    passwordError.textContent = "";
    confirmError.textContent = "";
    nicknameError.textContent = "";
    success.textContent = "";
    success.className = "";
  }

  function runClientValidation() {
    emailError.textContent = validateEmail(email.value.trim());

    const passwordValue = password.value;
    const confirmValue = confirm.value;

    passwordError.textContent =
      !passwordValue || passwordValue.length < 6
        ? "Пароль слишком короткий (<6 символов)"
        : "";

    confirmError.textContent =
      passwordValue && confirmValue && passwordValue !== confirmValue
        ? "Пароли не совпадают"
        : "";

    nicknameError.textContent = validateNickname(nickname.value.trim());
  }

  [email, password, confirm, nickname].forEach((field) => {
    field.addEventListener("input", () => {
      updateButton();
      runClientValidation();
    });
  });

  registerBtn.addEventListener("click", async () => {
    clearErrors();
    runClientValidation();
    if (
      emailError.textContent ||
      passwordError.textContent ||
      confirmError.textContent ||
      nicknameError.textContent
    ) {
      return;
    }

    try {
      await api.register({
        email: email.value.trim(),
        password: password.value,
        confirmPassword: confirm.value,
        nickname: nickname.value.trim()
      });
      wrapper.innerHTML = `
        <div class="card">
          <h2>Регистрация прошла успешно. Проверьте email для подтверждения.</h2>
          <p>Мы отправили письмо с подтверждением. Ссылка действует 24 часа.</p>
          <p class="link" id="loginAfter">Перейти ко входу</p>
        </div>
      `;
      wrapper.querySelector("#loginAfter").addEventListener("click", () => onSuccess());
    } catch (err) {
      const payload = err?.responseErrors || {};
      if (payload.email) emailError.textContent = payload.email;
      if (payload.password) {
        passwordError.textContent = payload.password;
        confirmError.textContent = payload.password;
      }
      if (payload.nickname) nicknameError.textContent = payload.nickname;
      if (!payload.email && !payload.password && !payload.nickname) {
        success.textContent = err.message;
        success.className = "notice error";
      }
    }
  });

  wrapper.querySelector("#loginLink").addEventListener("click", () => {
    onLogin();
  });

  updateButton();
  return wrapper;
}
