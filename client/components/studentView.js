import { api } from "./services.js";

export function renderStudentView(user) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div class="card">
      <h2>Привет, ${user.email}</h2>
      <p class="tag">Роль: студент</p>
      <div id="exercise"></div>
    </div>
  `;

  const exerciseContainer = wrapper.querySelector("#exercise");
  let currentIndex = 0;
  let exercises = [];

  async function loadExercises() {
    exercises = await api.getExercises();
    renderExercise();
  }

  function renderExercise() {
    if (exercises.length === 0) {
      exerciseContainer.innerHTML = "<p>Упражнений пока нет.</p>";
      return;
    }

    const exercise = exercises[currentIndex];
    exerciseContainer.innerHTML = `
      <p><strong>Упражнение ${currentIndex + 1} из ${exercises.length}</strong></p>
      <p>${exercise.sentence}</p>
      <div class="options"></div>
      <div id="feedback"></div>
      <button class="button secondary" id="next" style="margin-top: 12px;">Следующее</button>
    `;

    const optionsWrap = exerciseContainer.querySelector(".options");
    const feedback = exerciseContainer.querySelector("#feedback");
    const nextBtn = exerciseContainer.querySelector("#next");
    nextBtn.disabled = true;

    exercise.options.forEach((option, index) => {
      const btn = document.createElement("button");
      btn.className = "button secondary";
      btn.textContent = option;
      btn.addEventListener("click", async () => {
        const isCorrect = index === exercise.correctIndex;
        feedback.textContent = isCorrect ? "Верно!" : "Неправильно.";
        feedback.className = isCorrect ? "notice success" : "notice error";
        nextBtn.disabled = false;

        await api.saveResult(exercise.id, index, isCorrect);
      });
      optionsWrap.appendChild(btn);
    });

    nextBtn.addEventListener("click", () => {
      currentIndex = (currentIndex + 1) % exercises.length;
      renderExercise();
    });
  }

  loadExercises();
  return wrapper;
}
