import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";

const DEFAULT_DB_PATH = path.join(process.cwd(), "server", "data", "app.db");
const DB_PATH =
  process.env.DB_PATH ||
  (process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "app.db")
    : DEFAULT_DB_PATH);
const EXERCISES_PATH = path.join(process.cwd(), "exercises.json");

sqlite3.verbose();

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new sqlite3.Database(DB_PATH);

function addColumnIfMissing(table, column, definition) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table})`, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      const exists = rows.some((row) => row.name === column);
      if (exists) {
        resolve();
        return;
      }
      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, (alterErr) => {
        if (alterErr) {
          reject(alterErr);
          return;
        }
        resolve();
      });
    });
  });
}

export function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(
        `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL
        )`
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS exercises (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sentence TEXT NOT NULL,
          options_json TEXT NOT NULL,
          correct_index INTEGER NOT NULL
        )`
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          exercise_id INTEGER NOT NULL,
          answer_index INTEGER NOT NULL,
          is_correct INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (exercise_id) REFERENCES exercises(id)
        )`
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS verification_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token TEXT UNIQUE NOT NULL,
          expires_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`
      );

      Promise.all([
        addColumnIfMissing("users", "email_verified", "INTEGER NOT NULL DEFAULT 0"),
        addColumnIfMissing("users", "nickname", "TEXT"),
        addColumnIfMissing("users", "created_at", "TEXT")
      ])
        .then(() =>
          new Promise((resolveIndex, rejectIndex) => {
            db.run(
              "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname)",
              (idxErr) => {
                if (idxErr) {
                  rejectIndex(idxErr);
                  return;
                }
                resolveIndex();
              }
            );
          })
        )
        .then(async () => {
          await seedUsers();
          await seedExercises();
          resolve();
        })
        .catch((err) => {
          reject(err);
        });
    });
  });
}

function seedUsers() {
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) as count FROM users", async (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      if (row.count > 0) {
        resolve();
        return;
      }

      const adminHash = bcrypt.hashSync("admin123", 10);
      const studentHash = bcrypt.hashSync("student123", 10);
      const createdAt = new Date().toISOString();

      const stmt = db.prepare(
        "INSERT INTO users (email, email_verified, password_hash, nickname, role, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      );
      stmt.run("admin@example.com", 1, adminHash, "admin", "teacher", createdAt);
      stmt.run("student@example.com", 1, studentHash, "student", "student", createdAt);
      stmt.finalize((finalizeErr) => {
        if (finalizeErr) {
          reject(finalizeErr);
          return;
        }
        resolve();
      });
    });
  });
}

function seedExercises() {
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) as count FROM exercises", (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      if (row.count > 0) {
        resolve();
        return;
      }

      if (!fs.existsSync(EXERCISES_PATH)) {
        resolve();
        return;
      }

      const raw = fs.readFileSync(EXERCISES_PATH, "utf-8");
      const items = JSON.parse(raw);
      const stmt = db.prepare(
        "INSERT INTO exercises (sentence, options_json, correct_index) VALUES (?, ?, ?)"
      );

      for (const item of items) {
        const correctIndex =
          typeof item.correctIndex === "number" ? item.correctIndex : item.correct_index;
        stmt.run(item.sentence, JSON.stringify(item.options), correctIndex);
      }

      stmt.finalize((finalizeErr) => {
        if (finalizeErr) {
          reject(finalizeErr);
          return;
        }
        resolve();
      });
    });
  });
}
