import { api } from "./services.js";

function flattenSections(nodes, depth = 0, result = []) {
  nodes.forEach((node) => {
    result.push({
      id: node.id,
      name: `${"  ".repeat(depth)}${node.name}`,
      isActive: node.isActive
    });
    flattenSections(node.children || [], depth + 1, result);
  });
  return result;
}

function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function renderTeacherView(user) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div class="card">
      <h2>Hi, ${user.nickname || user.email}! Let's do some English practice 🙂</h2>
      <p class="tag">Роль: преподаватель</p>
    </div>
    <div class="card">
      <h3>Добавить упражнение</h3>
      <select class="input" id="sectionSelect"></select>
      <select class="input" id="exerciseType">
        <option value="multiple_choice">multiple_choice</option>
        <option value="fill_in_the_blanks">fill_in_the_blanks</option>
        <option value="sentence_builder">sentence_builder</option>
      </select>
      <input class="input" id="sentence" placeholder="Краткий заголовок/инструкция упражнения" />

      <div id="multipleChoiceFields" class="dynamic-block">
        <input class="input" id="opt1" placeholder="Вариант 1" />
        <input class="input" id="opt2" placeholder="Вариант 2" />
        <input class="input" id="opt3" placeholder="Вариант 3" />
        <input class="input" id="opt4" placeholder="Вариант 4" />
        <input class="input" id="correct" type="number" min="1" max="4" placeholder="Номер правильного варианта (1-4)" />
      </div>

      <div id="fillBlanksFields" class="dynamic-block" style="display:none;">
        <input class="input" id="fillTemplate" placeholder="She ___ to work every ___" />
        <div id="fillAnswers"></div>
      </div>

      <div id="sentenceBuilderFields" class="dynamic-block" style="display:none;">
        <input class="input" id="builderCorrectSentence" placeholder="She goes to work every day" />
        <button class="button secondary" id="generateWords" type="button">Сгенерировать слова</button>
        <textarea class="input" id="builderWords" rows="3" placeholder="words через запятую"></textarea>
        <textarea class="input" id="builderCorrectOrder" rows="3" placeholder="correct_order через запятую"></textarea>
      </div>

      <button class="button" id="add">Сохранить</button>
      <div id="addMessage"></div>
    </div>
    <div class="card">
      <h3>Результаты учеников</h3>
      <div id="results"></div>
    </div>
  `;

  const sectionSelect = wrapper.querySelector("#sectionSelect");
  const exerciseType = wrapper.querySelector("#exerciseType");
  const sentence = wrapper.querySelector("#sentence");

  const multipleChoiceFields = wrapper.querySelector("#multipleChoiceFields");
  const opt1 = wrapper.querySelector("#opt1");
  const opt2 = wrapper.querySelector("#opt2");
  const opt3 = wrapper.querySelector("#opt3");
  const opt4 = wrapper.querySelector("#opt4");
  const correct = wrapper.querySelector("#correct");

  const fillBlanksFields = wrapper.querySelector("#fillBlanksFields");
  const fillTemplate = wrapper.querySelector("#fillTemplate");
  const fillAnswers = wrapper.querySelector("#fillAnswers");

  const sentenceBuilderFields = wrapper.querySelector("#sentenceBuilderFields");
  const builderCorrectSentence = wrapper.querySelector("#builderCorrectSentence");
  const builderWords = wrapper.querySelector("#builderWords");
  const builderCorrectOrder = wrapper.querySelector("#builderCorrectOrder");

  const addMessage = wrapper.querySelector("#addMessage");
  const resultsContainer = wrapper.querySelector("#results");

  function renderSectionOptions(nodes) {
    const flat = flattenSections(nodes);
    if (flat.length === 0) {
      sectionSelect.innerHTML = '<option value="">Разделы не найдены</option>';
      return;
    }

    sectionSelect.innerHTML = flat
      .map((item) => {
        const suffix = item.isActive ? "" : " (off)";
        return `<option value="${item.id}">${item.name}${suffix}</option>`;
      })
      .join("");
  }

  function buildFillAnswersInputs() {
    const template = fillTemplate.value;
    const placeholders = (template.match(/___/g) || []).length;
    fillAnswers.innerHTML = "";

    if (placeholders === 0) {
      return;
    }

    for (let i = 0; i < placeholders; i += 1) {
      const input = document.createElement("input");
      input.className = "input fill-answer";
      input.placeholder = `Answer ${i + 1}`;
      input.dataset.index = String(i);
      fillAnswers.appendChild(input);
    }
  }

  function parseCsvWords(value) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  function toggleExerciseTypeFields() {
    const type = exerciseType.value;
    multipleChoiceFields.style.display = type === "multiple_choice" ? "block" : "none";
    fillBlanksFields.style.display = type === "fill_in_the_blanks" ? "block" : "none";
    sentenceBuilderFields.style.display = type === "sentence_builder" ? "block" : "none";
  }

  wrapper.querySelector("#generateWords").addEventListener("click", () => {
    const correctSentence = builderCorrectSentence.value.trim();
    if (!correctSentence) {
      addMessage.textContent = "Введите правильное предложение для генерации.";
      addMessage.className = "notice error";
      return;
    }

    const words = correctSentence.split(/\s+/).filter((item) => item.length > 0);
    const shuffled = shuffleArray(words);
    builderWords.value = shuffled.join(", ");
    builderCorrectOrder.value = words.join(", ");
  });

  fillTemplate.addEventListener("input", buildFillAnswersInputs);
  exerciseType.addEventListener("change", toggleExerciseTypeFields);

  async function loadSections() {
    const tree = await api.getSectionsTree(true);
    renderSectionOptions(tree);
  }

  async function loadResults() {
    const results = await api.getResults();
    if (results.length === 0) {
      resultsContainer.innerHTML = "<p>Результатов пока нет.</p>";
      return;
    }

    resultsContainer.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Ученик</th>
            <th>Предложение</th>
            <th>Ответ</th>
            <th>Дата</th>
          </tr>
        </thead>
        <tbody>
          ${results
            .map(
              (row) => `
              <tr>
                <td>${row.student_email}</td>
                <td>${row.sentence}</td>
                <td>${row.is_correct ? "Верно" : "Неверно"}</td>
                <td>${new Date(row.created_at).toLocaleString("ru-RU")}</td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  wrapper.querySelector("#add").addEventListener("click", async () => {
    addMessage.textContent = "";
    addMessage.className = "";

    const selectedSectionId = Number.parseInt(sectionSelect.value, 10);
    const selectedExerciseType = exerciseType.value;
    const sentenceText = sentence.value.trim();

    if (Number.isNaN(selectedSectionId)) {
      addMessage.textContent = "Выберите раздел.";
      addMessage.className = "notice error";
      return;
    }

    const payload = {
      section_id: selectedSectionId,
      exercise_type: selectedExerciseType,
      sentence: sentenceText
    };

    if (selectedExerciseType === "multiple_choice") {
      if (!sentenceText) {
        addMessage.textContent = "Введите текст упражнения.";
        addMessage.className = "notice error";
        return;
      }

      const options = [opt1.value, opt2.value, opt3.value, opt4.value].map((v) => v.trim());
      const correctIndex = Number.parseInt(correct.value, 10) - 1;

      if (options.some((v) => !v)) {
        addMessage.textContent = "Заполните все 4 варианта ответа.";
        addMessage.className = "notice error";
        return;
      }

      if (Number.isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) {
        addMessage.textContent = "Правильный ответ должен быть от 1 до 4.";
        addMessage.className = "notice error";
        return;
      }

      payload.content_json = {
        options,
        correct_index: correctIndex
      };
    }

    if (selectedExerciseType === "fill_in_the_blanks") {
      const template = fillTemplate.value.trim();
      const placeholders = (template.match(/___/g) || []).length;

      if (!template || placeholders < 1) {
        addMessage.textContent = "Введите шаблон с минимум одним ___";
        addMessage.className = "notice error";
        return;
      }

      const answers = Array.from(fillAnswers.querySelectorAll(".fill-answer")).map((input) =>
        input.value.trim()
      );

      if (answers.length !== placeholders || answers.some((answer) => !answer)) {
        addMessage.textContent = "Заполните ответы для всех пропусков.";
        addMessage.className = "notice error";
        return;
      }

      const chunks = template.split("___");
      const parts = [];

      for (let i = 0; i < chunks.length; i += 1) {
        parts.push({ type: "text", value: chunks[i] });
        if (i < answers.length) {
          parts.push({ type: "input", answer: answers[i] });
        }
      }

      payload.sentence = sentenceText || template;
      payload.content_json = { parts };
    }

    if (selectedExerciseType === "sentence_builder") {
      const correctSentence = builderCorrectSentence.value.trim();
      const words = parseCsvWords(builderWords.value);
      const correctOrder = parseCsvWords(builderCorrectOrder.value);

      if (!correctSentence) {
        addMessage.textContent = "Введите правильное предложение.";
        addMessage.className = "notice error";
        return;
      }

      if (words.length === 0 || correctOrder.length === 0) {
        addMessage.textContent = "Заполните words и correct_order.";
        addMessage.className = "notice error";
        return;
      }

      payload.sentence = sentenceText || correctSentence;
      payload.content_json = {
        words,
        correct_order: correctOrder
      };
    }

    try {
      await api.addExercise(payload);

      sentence.value = "";
      opt1.value = "";
      opt2.value = "";
      opt3.value = "";
      opt4.value = "";
      correct.value = "";
      fillTemplate.value = "";
      fillAnswers.innerHTML = "";
      builderCorrectSentence.value = "";
      builderWords.value = "";
      builderCorrectOrder.value = "";

      addMessage.textContent = "Упражнение добавлено.";
      addMessage.className = "notice success";
    } catch (err) {
      addMessage.textContent = err.message;
      addMessage.className = "notice error";
    }
  });

  toggleExerciseTypeFields();
  loadSections();
  loadResults();
  return wrapper;
}
