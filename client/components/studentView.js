import { api } from "./services.js";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function arraysEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export function renderStudentView(user) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div class="card">
      <h2 id="studentGreeting" class="student-greeting">Hi, ${user.nickname || user.email}! Let's do some English practice 🙂</h2>
      <div id="studentContent"></div>
    </div>
  `;

  const studentContent = wrapper.querySelector("#studentContent");
  const greeting = wrapper.querySelector("#studentGreeting");
  const sectionPath = [];

  function updateGreetingVisibility() {
    greeting.style.display = sectionPath.length === 0 ? "block" : "none";
  }

  function renderPath() {
    if (sectionPath.length === 0) {
      return "";
    }

    const crumbs = sectionPath
      .map((section, index) => `<button class="crumb" data-index="${index}">${section.name}</button>`)
      .join("<span>/</span>");

    return `<div class="breadcrumbs">${crumbs}</div>`;
  }

  function bindBreadcrumbs() {
    studentContent.querySelectorAll(".crumb").forEach((crumb) => {
      crumb.addEventListener("click", (event) => {
        const index = Number.parseInt(event.target.dataset.index, 10);
        sectionPath.splice(index + 1);
        const current = sectionPath.length > 0 ? sectionPath[sectionPath.length - 1].id : null;
        showSections(current);
      });
    });
  }

  async function showSections(parentId = null) {
    updateGreetingVisibility();

    const sections = await api.getSections(parentId);
    if (sections.length === 0 && parentId != null) {
      await showExercises(sectionPath[sectionPath.length - 1]);
      return;
    }

    studentContent.innerHTML = `
      ${renderPath()}
      <div class="section-list" id="sectionList"></div>
    `;

    const sectionList = studentContent.querySelector("#sectionList");

    if (sections.length === 0) {
      sectionList.innerHTML = "<p>Разделы отсутствуют.</p>";
      return;
    }

    sections.forEach((section) => {
      const button = document.createElement("button");
      button.className = "button secondary section-item";
      button.textContent = section.name;
      button.addEventListener("click", () => {
        sectionPath.push({ id: section.id, name: section.name });
        showSections(section.id);
      });
      sectionList.appendChild(button);
    });

    bindBreadcrumbs();
  }

  async function showExercises(section) {
    updateGreetingVisibility();

    const exercises = await api.getExercises(section.id);
    let currentIndex = 0;

    if (exercises.length === 0) {
      studentContent.innerHTML = `
        ${renderPath()}
        <p>В этом разделе пока нет упражнений.</p>
      `;
      bindBreadcrumbs();
      return;
    }

    function renderExercise() {
      const exercise = exercises[currentIndex];
      const type = exercise.exerciseType;
      const content = exercise.contentJson || {};

      studentContent.innerHTML = `
        ${renderPath()}
        <p class="exercise-counter">Упражнение ${currentIndex + 1} из ${exercises.length}</p>
        <p class="exercise-sentence">${exercise.sentence}</p>
        <div class="options" id="options"></div>
        <div id="feedback"></div>
        <button class="button secondary" id="next" style="margin-top: 12px;">Следующее</button>
      `;

      const optionsWrap = studentContent.querySelector("#options");
      const feedback = studentContent.querySelector("#feedback");
      const nextBtn = studentContent.querySelector("#next");
      nextBtn.disabled = true;

      if (type === "multiple_choice") {
        const options = Array.isArray(content.options) ? content.options : exercise.options;
        const correctIndex = Number.isInteger(content.correct_index)
          ? content.correct_index
          : exercise.correctIndex;

        options.forEach((option, index) => {
          const btn = document.createElement("button");
          btn.className = "button secondary";
          btn.textContent = option;
          btn.addEventListener("click", async () => {
            const isCorrect = index === correctIndex;
            feedback.textContent = isCorrect ? "Верно!" : "Неправильно.";
            feedback.className = isCorrect ? "notice success" : "notice error";

            btn.classList.remove("answer-correct", "answer-incorrect");
            btn.classList.add(isCorrect ? "answer-correct" : "answer-incorrect");

            if (isCorrect) {
              nextBtn.disabled = false;
              const allOptionButtons = optionsWrap.querySelectorAll("button");
              allOptionButtons.forEach((item) => {
                item.disabled = true;
              });
            }

            await api.saveResult(exercise.id, index, isCorrect);
          });
          optionsWrap.appendChild(btn);
        });
      } else if (type === "fill_in_the_blanks") {
        const parts = Array.isArray(content.parts) ? content.parts : [];
        const line = document.createElement("div");
        line.className = "fill-line";

        const inputs = [];
        parts.forEach((part) => {
          if (part.type === "text") {
            const span = document.createElement("span");
            span.textContent = String(part.value || "");
            line.appendChild(span);
          }

          if (part.type === "input") {
            const input = document.createElement("input");
            input.className = "fill-input";
            input.type = "text";
            input.dataset.answer = String(part.answer || "");
            inputs.push(input);
            line.appendChild(input);
          }
        });

        const checkBtn = document.createElement("button");
        checkBtn.className = "button secondary";
        checkBtn.textContent = "Проверить";

        checkBtn.addEventListener("click", async () => {
          if (inputs.length === 0) {
            feedback.textContent = "Некорректная структура упражнения.";
            feedback.className = "notice error";
            return;
          }

          const isCorrect = inputs.every((input) => normalize(input.value) === normalize(input.dataset.answer));
          feedback.textContent = isCorrect ? "Верно!" : "Неправильно.";
          feedback.className = isCorrect ? "notice success" : "notice error";

          await api.saveResult(exercise.id, -1, isCorrect);
          if (isCorrect) {
            nextBtn.disabled = false;
            inputs.forEach((input) => {
              input.disabled = true;
            });
            checkBtn.disabled = true;
          }
        });

        optionsWrap.appendChild(line);
        optionsWrap.appendChild(checkBtn);
      } else if (type === "sentence_builder") {
        const words = Array.isArray(content.words) ? content.words.map(String) : [];
        const correctOrder = Array.isArray(content.correct_order)
          ? content.correct_order.map((item) => normalize(item))
          : [];

        const pool = document.createElement("div");
        pool.className = "builder-pool";

        const answer = document.createElement("div");
        answer.className = "builder-answer";

        const controls = document.createElement("div");
        controls.className = "builder-controls";

        const checkBtn = document.createElement("button");
        checkBtn.className = "button secondary";
        checkBtn.textContent = "Проверить";

        const resetBtn = document.createElement("button");
        resetBtn.className = "button secondary";
        resetBtn.textContent = "Сброс";

        controls.appendChild(checkBtn);
        controls.appendChild(resetBtn);

        let selectedWords = [];

        function renderBuilder() {
          pool.innerHTML = "";
          answer.innerHTML = "";

          words.forEach((word, index) => {
            if (selectedWords.includes(index)) {
              return;
            }
            const wordBtn = document.createElement("button");
            wordBtn.className = "button secondary builder-word";
            wordBtn.textContent = word;
            wordBtn.addEventListener("click", () => {
              selectedWords.push(index);
              renderBuilder();
            });
            pool.appendChild(wordBtn);
          });

          selectedWords.forEach((index) => {
            const token = document.createElement("span");
            token.className = "builder-token";
            token.textContent = words[index];
            answer.appendChild(token);
          });
        }

        checkBtn.addEventListener("click", async () => {
          const attempt = selectedWords.map((index) => normalize(words[index]));
          const isCorrect = arraysEqual(attempt, correctOrder);

          feedback.textContent = isCorrect ? "Верно!" : "Неправильно.";
          feedback.className = isCorrect ? "notice success" : "notice error";

          await api.saveResult(exercise.id, -1, isCorrect);
          if (isCorrect) {
            nextBtn.disabled = false;
            checkBtn.disabled = true;
            resetBtn.disabled = true;
          }
        });

        resetBtn.addEventListener("click", () => {
          selectedWords = [];
          renderBuilder();
        });

        renderBuilder();
        optionsWrap.appendChild(pool);
        optionsWrap.appendChild(answer);
        optionsWrap.appendChild(controls);
      } else {
        nextBtn.disabled = false;
        optionsWrap.innerHTML = '<p class="notice">Этот тип упражнения пока не поддерживается.</p>';
      }

      nextBtn.addEventListener("click", () => {
        currentIndex = (currentIndex + 1) % exercises.length;
        renderExercise();
      });

      bindBreadcrumbs();
    }

    renderExercise();
  }

  showSections(null);
  return wrapper;
}
