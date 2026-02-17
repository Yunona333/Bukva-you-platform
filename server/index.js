import express from "express";
import path from "path";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db, initDb } from "./db.js";

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;

const RESERVED_NICKNAMES = new Set([
  "admin",
  "support",
  "system",
  "bukvayou",
  "yunona",
  "yuna"
]);

app.use(express.json());

function createToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

function authRequired(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  const token = auth.replace("Bearer ", "");
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password, confirmPassword) {
  if (!password || password.length < 6) {
    return "Пароль слишком короткий (<6 символов)";
  }
  if (password !== confirmPassword) {
    return "Пароли не совпадают";
  }
  return null;
}

function validateNickname(nickname) {
  if (!nickname) {
    return "Никнейм содержит недопустимые символы или запрещённое слово";
  }
  const lower = nickname.toLowerCase();
  if (RESERVED_NICKNAMES.has(lower)) {
    return "Никнейм содержит недопустимые символы или запрещённое слово";
  }
  if (!/^[A-Za-z0-9_]{3,20}$/.test(nickname)) {
    return "Никнейм содержит недопустимые символы или запрещённое слово";
  }
  return null;
}

function generateVerificationToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function renderVerificationPage(message) {
  return `<!doctype html>
  <html lang="ru">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Bukva YOU</title>
      <style>
        body { font-family: "Georgia", "Times New Roman", serif; background: #f4f0e8; margin: 0; padding: 32px; }
        .card { max-width: 560px; margin: 60px auto; background: #fffaf2; border-radius: 20px; padding: 32px; box-shadow: 0 16px 34px rgba(0,0,0,0.08); }
        h1 { margin-top: 0; }
        .tag { display: inline-block; background: #efe7dc; padding: 6px 10px; border-radius: 10px; font-size: 12px; margin-bottom: 12px; }
      </style>
    </head>
    <body>
      <div class="card">
        <span class="tag">Bukva YOU</span>
        <h1>${message}</h1>
        <p>Английский нам не ерунда, это база на года</p>
      </div>
    </body>
  </html>`;
}

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
    if (err) {
      res.status(500).json({ error: "Database error" });
      return;
    }

    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    res.json({
      token: createToken(row),
      user: { id: row.id, email: row.email, role: row.role, nickname: row.nickname }
    });
  });
});

app.post("/api/auth/register", (req, res) => {
  const { email, password, confirmPassword, nickname } = req.body || {};
  const errors = {};

  if (!email || !isValidEmail(email)) {
    errors.email = "Некорректный формат email";
  }

  const passwordError = validatePassword(password, confirmPassword);
  if (passwordError) {
    errors.password = passwordError;
  }

  const nicknameError = validateNickname(nickname);
  if (nicknameError) {
    errors.nickname = nicknameError;
  }

  if (Object.keys(errors).length > 0) {
    res.status(400).json({ errors });
    return;
  }

  db.all(
    "SELECT email, nickname FROM users WHERE email = ? OR nickname = ?",
    [email, nickname],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: "Database error" });
        return;
      }

      const emailTaken = rows.some((row) => row.email === email);
      const nicknameTaken = rows.some((row) => row.nickname === nickname);

      if (emailTaken) {
        errors.email = "Email уже зарегистрирован";
      }
      if (nicknameTaken) {
        errors.nickname = "Никнейм занят";
      }

      if (Object.keys(errors).length > 0) {
        res.status(400).json({ errors });
        return;
      }

      const hash = bcrypt.hashSync(password, 10);
      const createdAt = new Date().toISOString();
      db.run(
        "INSERT INTO users (email, email_verified, password_hash, nickname, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [email, 0, hash, nickname, "student", createdAt],
        function (insertErr) {
          if (insertErr) {
            res.status(500).json({ error: "Database error" });
            return;
          }

          const userId = this.lastID;
          const token = generateVerificationToken();
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

          db.run(
            "INSERT INTO verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
            [userId, token, expiresAt],
            (tokenErr) => {
              if (tokenErr) {
                res.status(500).json({ error: "Database error" });
                return;
              }

              const verifyUrl = `${APP_BASE_URL}/verify-email?token=${token}`;
              console.log(`Verification email to ${email}: ${verifyUrl}`);

              res.json({
                message: "Регистрация успешна. Проверьте email для подтверждения."
              });
            }
          );
        }
      );
    }
  );
});

app.get("/api/auth/verify-email", (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== "string") {
    res
      .status(400)
      .send(renderVerificationPage("Ссылка недействительна или устарела. Повторите регистрацию."));
    return;
  }

  db.get(
    "SELECT id, user_id, expires_at FROM verification_tokens WHERE token = ?",
    [token],
    (err, row) => {
      if (err || !row) {
        res
          .status(400)
          .send(renderVerificationPage("Ссылка недействительна или устарела. Повторите регистрацию."));
        return;
      }

      const isExpired = new Date(row.expires_at).getTime() < Date.now();
      if (isExpired) {
        db.run("DELETE FROM verification_tokens WHERE id = ?", [row.id]);
        res
          .status(400)
          .send(renderVerificationPage("Ссылка недействительна или устарела. Повторите регистрацию."));
        return;
      }

      db.run("UPDATE users SET email_verified = 1 WHERE id = ?", [row.user_id], (updateErr) => {
        if (updateErr) {
          res.status(500).send(renderVerificationPage("Произошла ошибка. Попробуйте позже."));
          return;
        }

        db.run("DELETE FROM verification_tokens WHERE id = ?", [row.id]);
        res.send(renderVerificationPage("Email подтверждён. Можно войти."));
      });
    }
  );
});

app.get("/api/auth/me", authRequired, (req, res) => {
  db.get("SELECT id, email, role, nickname FROM users WHERE id = ?", [req.user.id], (err, row) => {
    if (err || !row) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(row);
  });
});

app.get("/api/exercises", authRequired, (req, res) => {
  db.all("SELECT id, sentence, options_json, correct_index FROM exercises", (err, rows) => {
    if (err) {
      res.status(500).json({ error: "Database error" });
      return;
    }

    const data = rows.map((row) => ({
      id: row.id,
      sentence: row.sentence,
      options: JSON.parse(row.options_json),
      correctIndex: row.correct_index
    }));
    res.json(data);
  });
});

app.post("/api/results", authRequired, requireRole("student"), (req, res) => {
  const { exerciseId, answerIndex, isCorrect } = req.body || {};
  if (exerciseId == null || answerIndex == null || isCorrect == null) {
    res.status(400).json({ error: "Missing result data" });
    return;
  }

  const createdAt = new Date().toISOString();
  db.run(
    "INSERT INTO results (user_id, exercise_id, answer_index, is_correct, created_at) VALUES (?, ?, ?, ?, ?)",
    [req.user.id, exerciseId, answerIndex, isCorrect ? 1 : 0, createdAt],
    function (err) {
      if (err) {
        res.status(500).json({ error: "Database error" });
        return;
      }
      res.json({ id: this.lastID });
    }
  );
});

app.get("/api/results", authRequired, requireRole("teacher"), (req, res) => {
  const query = `
    SELECT results.id, users.email as student_email, results.is_correct, results.answer_index,
           results.created_at, exercises.sentence
    FROM results
    JOIN users ON users.id = results.user_id
    JOIN exercises ON exercises.id = results.exercise_id
    ORDER BY results.created_at DESC
  `;

  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: "Database error" });
      return;
    }
    res.json(rows);
  });
});

app.post("/api/exercises", authRequired, requireRole("teacher"), (req, res) => {
  const { sentence, options, correctIndex } = req.body || {};
  if (!sentence || !Array.isArray(options) || options.length !== 4 || correctIndex == null) {
    res.status(400).json({ error: "Invalid exercise format" });
    return;
  }

  db.run(
    "INSERT INTO exercises (sentence, options_json, correct_index) VALUES (?, ?, ?)",
    [sentence, JSON.stringify(options), correctIndex],
    function (err) {
      if (err) {
        res.status(500).json({ error: "Database error" });
        return;
      }
      res.json({ id: this.lastID });
    }
  );
});

app.use(express.static(path.join(process.cwd(), "client")));

app.get("/verify-email", (req, res) => {
  const { token } = req.query;
  res.redirect(`/api/auth/verify-email?token=${encodeURIComponent(token || "")}`);
});

app.get("*", (req, res) => {
  res.sendFile(path.join(process.cwd(), "client", "index.html"));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database", err);
    process.exit(1);
  });
