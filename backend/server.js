const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const jwt = require("jsonwebtoken");
const path = require("path");
const bcrypt = require("bcrypt");
const { error } = require("console");
const saltRounds = 10;
const API_KEY = process.env.API_KEY

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || "chess-trainer-jwt-secret-key"; // Use env variable in production


// Middleware
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
        : "*",
  })
);

// app.use(
//   cors({
//     origin: "*",
//   })
// );


app.use(bodyParser.json());


// Database path - for production, use Azure storage mounted path if available
const dbPath =
  process.env.DB_PATH || path.join(__dirname, "chess_exercises.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("Connected to the database");
    initDb();
  }
});

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Forbidden: Invalid token" });
    }
    req.user = user;
    next();
  });
};

// Create users table if not exists
const initDb = () => {
  db.run(
    `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      group_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    (err) => {
      if (err) {
        console.error("Error creating users table:", err.message);
      } else {
        console.log("Users table initialized");
        createPuzzleResultsTable();
      }
    }
  );

  // Create puzzle_results table
  const createPuzzleResultsTable = () => {
    db.run(
      `
      CREATE TABLE IF NOT EXISTS puzzle_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        exercise_id INTEGER NOT NULL,
        is_solved BOOLEAN NOT NULL,
        selected_motive TEXT, 
        attempts INTEGER NOT NULL DEFAULT 0,
        correct_moves INTEGER NOT NULL DEFAULT 0,
        incorrect_moves INTEGER NOT NULL DEFAULT 0,
        time_spent_seconds INTEGER NOT NULL DEFAULT 0,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (exercise_id) REFERENCES exercises_test(id)
      )
    `,
      (err) => {
        if (err) {
          console.error("Error creating puzzle_results table:", err.message);
        } else {
          console.log("Puzzle results table initialized");
          createSessionLogsTable();
        }
      }
    );
  };

  // Create session_logs table
  const createSessionLogsTable = () => {
    db.run(
      `
      CREATE TABLE IF NOT EXISTS session_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP,
        total_time_seconds INTEGER,
        puzzles_completed INTEGER NOT NULL DEFAULT 0,
        puzzles_solved INTEGER NOT NULL DEFAULT 0,
        completed BOOLEAN NOT NULL DEFAULT 0,
        next_available_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `,
      (err) => {
        if (err) {
          console.error("Error creating session_logs table:", err.message);
        } else {
          console.log("Session logs table initialized");
          createPuzzleMoveTimesTable();
        }
      }
    );
  };

  // Create puzzle_move_times table
  const createPuzzleMoveTimesTable = () => {
    db.run(
      `
      CREATE TABLE IF NOT EXISTS puzzle_move_times (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        puzzle_result_id INTEGER NOT NULL,
        move_number INTEGER NOT NULL,
        move_uci TEXT NOT NULL,
        is_correct BOOLEAN NOT NULL,
        time_spent_ms INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (puzzle_result_id) REFERENCES puzzle_results(id)
      )
    `,
      (err) => {
        if (err) {
          console.error("Error creating puzzle_move_times table:", err.message);
        } else {
          console.log("Puzzle move times table initialized");
          createUserSessionTable();
        }
      }
    );
  };
  const createUserSessionTable = () => {
    db.run(
    `CREATE TABLE IF NOT EXISTS user_sessions (
      user_id TEXT PRIMARY KEY,
      exercise_ids TEXT NOT NULL,
      current_index INTEGER DEFAULT 0
      );`
      ,(err) => {
        if (err) {
          console.error("Error creating user_sessions table:", err.message);
        } else {
          console.log("User sessions table initialized");
       }
      } 
    )
  };
}

// API Routes
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// User registration
app.post("/api/users/register", (req, res) => {
  const { username, password, group_id} = req.body;

  // Check if user exists
  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    (err, existingUser) => {
      if (err) {
        console.error("Error checking user:", err.message);
        return res
          .status(500)
          .json({ error: "Server error during registration" });
      }

      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
      // Hash password
      bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
        if (err) {
          console.error("Error hashing password:", err.message);
          return res
            .status(500)
            .json({ error: "Server error during registration" });
        }

        // Insert new user with hashed password
        db.run(
          "INSERT INTO users (username, password, group_id) VALUES (?, ?, ?)",
          [username, hashedPassword, group_id],
          function (err) {
            if (err) {
              console.error("Error inserting user:", err.message);
              return res
                .status(500)
                .json({ error: "Server error during registration" });
            }

            const userId = this.lastID;

            // Generate token
            const token = jwt.sign(
              { id: userId, username},
              JWT_SECRET,
              { expiresIn: "24h" }
            );

            // Log registration
            console.log(
              `User registered: ${username}`
            );

            res.status(201).json({
              message: "User registered successfully",
              user_id: userId,
              username,
              group_id,
              access_token: token,
            });
          }
        );
      });
    });
  }
);

app.post("/api/users/new_register", (req, res) => {
  //API K3y
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== API_KEY) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { username, password, group_id } = req.body;

  if (!username || !password || group_id == null) {
    return res.status(400).json({ error: "Missing username or password" });
  }

  // check, user exists
  db.get("SELECT id FROM users WHERE username = ?", [username], (err, existingUser) => {
    if (err) {
      console.error("Error checking existing user:", err.message);
      return res.status(500).json({ error: "Server error" });
    }

    if (existingUser) {
      return res.status(200).json({ message: "User already exists" });
    }

    // add user with username and password
    db.run(
      "INSERT INTO users (username, password, group_id) VALUES (?, ?, ?)",
      [username, password, group_id],
      function (err) {
        if (err) {
          console.error("Error inserting new user:", err.message);
          return res.status(500).json({ error: "Server error inserting user" });
        }

        const userId = this.lastID;

        // token JWT
        const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: "24h" });

        console.log(`User ${username} added from other backend`);

        res.status(201).json({
          message: "User added successfully",
          user_id: userId,
          username,
          group_id,
          access_token: token,
        });
      }
    );
  });
});

// User login
app.post("/api/users/login", (req, res) => {
  const { username, password } = req.body;

  db.get(
    "SELECT id, username, password, created_at FROM users WHERE username = ?",
    [username],
    (err, user) => {
      if (err) {
        console.error("Error finding user:", err.message);
        return res.status(500).json({ error: "Server error during login" });
      }

      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) {
          console.error("Error comparing passwords:", err.message);
          return res.status(500).json({ error: "Server error during login" });
        }

        if (!isMatch) {
          return res.status(401).json({ error: "Invalid username or password" });
        }

        const createdAt = new Date(user.created_at);
        const now = new Date();
        const hoursSinceCreated = (now - createdAt) / (1000 * 60 * 60);

        if (hoursSinceCreated < 24) {
          return res.status(403).json({
            error: "You must wait 24 hours after registration to log in.",
            hours_left: Math.ceil(24 - hoursSinceCreated),
          });
        }

        const token = jwt.sign(
          { id: user.id, username: user.username },
          JWT_SECRET,
          { expiresIn: "24h" }
        );

        console.log(`User logged in: ${user.username}`);

        res.status(200).json({
          message: "Login successful",
          user_id: user.id,
          username: user.username,
          access_token: token,
        });
      });
    }
  );
});

app.get("/api/users/group", authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.get("SELECT group_id FROM users WHERE id = ?", [userId], (err, row) => {
    if (err) {
      console.error("Error fetching group_id:", err.message);
      return res.status(500).json({ error: "Server error" });
    }

    if (!row) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ group_id: row.group_id });
  });
});


// Get exercises for a session (requires auth)
app.get("/api/exercises_test", authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.get(
    `SELECT exercise_ids FROM user_sessions WHERE user_id = ?`,
    [userId],
    (err, row) => {
      if (err) {
        console.error("DB fetch error:", err.message);
        return res.status(500).json({ error: "Server error" });
      }

      if (row) {
        const ids = JSON.parse(row.exercise_ids);
        const placeholders = ids.map(() => '?').join(',');
        db.all(
          `SELECT * FROM exercises_test WHERE id IN (${placeholders})`,
          ids,
          (err, exercises) => {
            if (err) {
              return res.status(500).json({ error: "Fetch failed" });
            }

            const ordered = ids.map(id => exercises.find(e => e.id === id));
            return res.status(200).json(ordered);
          }
        );
      } else {
        db.all(`SELECT * FROM exercises_test`, [], (err, allExercises) => {
          if (err) {
            return res.status(500).json({ error: "Load failed" });
          }

          for (let i = allExercises.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allExercises[i], allExercises[j]] = [allExercises[j], allExercises[i]];
          }

          const selected = allExercises.slice(0, 27);
          const ids = selected.map(e => e.id);

          db.run(
            `INSERT INTO user_sessions (user_id, exercise_ids) VALUES (?, ?)`,
            [userId, JSON.stringify(ids)],
            (err) => {
              if (err) {
                return res.status(500).json({ error: "Insert failed" });
              }
              console.log(`Saved session for user ${userId}`);
              res.status(200).json(selected);
            }
          );
        });
      }
    }
  );
});

app.post("/api/update_session_index", authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { currentIndex } = req.body;

  db.run(
    `UPDATE user_sessions SET current_index = ? WHERE user_id = ?`,
    [currentIndex, userId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Update failed" });
      }
      res.status(200).json({ success: true });
    }
  );
});

app.get("/api/session_progress", authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.get(
    `SELECT current_index FROM user_sessions WHERE user_id = ?`,
    [userId],
    (err, row) => {
      if (err) {
        console.error("Error fetching session index:", err.message);
        return res.status(500).json({ error: "Server error" });
      }

      const index = row?.current_index || 0;
      res.status(200).json({ currentIndex: index });
    }
  );
});

// Start a test
app.post("/api/exercises_test/start", authenticateToken, (req, res) => {
  const userId = req.user.id;

    db.get(
      "SELECT id FROM session_logs WHERE user_id = ? AND completed = 0",
      [userId],
      (err, activeSession) => {
        if (err) {
          console.error("Error checking active session:", err.message);
          return res
            .status(500)
            .json({ error: "Server error checking session" });
        }

        db.get(
          "SELECT * FROM session_logs WHERE user_id = ? AND completed = 1 ORDER BY end_time DESC LIMIT 1",
          [userId],
          (err, lastSession) => {
            if (err) {
              console.error("Error checking last session:", err.message);
              return res
                .status(500)
                .json({ error: "Server error checking last session" });
            }
            if (activeSession) {
              return res.status(400).json({
                error: "You already have an active session.",
                session_log_id: activeSession.id,
              });
            }
            db.run(
              "INSERT INTO session_logs (user_id) VALUES (?)",
              [userId],
              function (err) {
                if (err) {
                  console.error("Error creating session log:", err.message);
                  return res
                    .status(500)
                    .json({ error: "Server error creating session log" });
                }

                const sessionLogId = this.lastID;
                console.log(
                  `User ${userId} started test`
                );

                res.status(201).json({
                  message: "Test started successfully",
                  session_log_id: sessionLogId,
                });
              }
            );
          }
        );
      }
    );
  }
);

// Complete a session
app.post(
  "/api/sessions_Logs/complete",
  authenticateToken,
  (req, res) => {
    const { sessionLogId } = req.params;
    const userId = req.user.id;
    const { total_time_seconds, puzzles_completed, puzzles_solved } = req.body;

    // Verify the session belongs to the user
    db.get(
      "SELECT sl.*, u.* FROM session_logs sl JOIN users u ON sl.user_id = u.id WHERE sl.id = ? AND sl.user_id = ?",
      [sessionLogId, userId],
      (err, sessionLog) => {
        if (err) {
          console.error("Error finding session log:", err.message);
          return res
            .status(500)
            .json({ error: "Server error finding session log" });
        }

        if (!sessionLog) {
          return res
            .status(404)
            .json({ error: "Session log not found or unauthorized" });
        }

        if (sessionLog.completed) {
          return res.status(400).json({ error: "Session already completed" });
        }

        // Calculate next available time (24 hours from now)
        const now = new Date();
        const nextAvailable = new Date(now);
        nextAvailable.setHours(nextAvailable.getHours());

        // Update session log
        db.run(
          `UPDATE session_logs SET
         end_time = CURRENT_TIMESTAMP,
         total_time_seconds = ?,
         puzzles_completed = ?,
         puzzles_solved = ?,
         completed = 1,
         next_available_at = ?
         WHERE id = ?`,
          [
            total_time_seconds,
            puzzles_completed,
            puzzles_solved,
            nextAvailable.toISOString(),
            sessionLogId,
          ],
          (err) => {
            if (err) {
              console.error("Error updating session log:", err.message);
              return res
                .status(500)
                .json({ error: "Server error updating session log" });
            }

            console.log(
              `User ${userId}, log ID: ${sessionLogId}`
            );

            res.status(200).json({
              message: "Session completed successfully",
              next_available_at: nextAvailable.toISOString(),
            });
          }
        );
      }
    );
  }
);

// Record a puzzle result
app.post("/api/puzzles/results", authenticateToken, (req, res) => {
  const userId = req.user.id;
  const {
    exercise_id,
    is_solved,
    attempts,
    correct_moves,
    incorrect_moves,
    time_spent_seconds,
    move_times,
    selected_motive,
  } = req.body;

  // Check if this user has already completed this puzzle in the session
  db.get(
    `SELECT 1 FROM puzzle_results
     WHERE user_id = ? AND exercise_id = ?`,
    [userId, exercise_id],
    (err, existing) => {
      if (err) {
        console.error(
          "Error checking for existing puzzle result:",
          err.message
        );
        return res
          .status(500)
          .json({ error: "Server error checking puzzle result" });
      }

      if (existing) {
        return res.status(200).json({
          message: "Puzzle already solved, skipping to next.",
          already_solved: true,
        });
      } else {
        db.get(
        `SELECT motives FROM exercises_test where id = ?`,
        [exercise_id],
        (err, exercise) => {
          if(err){
          console.error("Error fetching motive for exercise ", err.message);
          return res
            .status(500)
            .json({error: "Server error fetching exercise motive"});
        }
        const exerciseMotive = exercise.motives;
        // Insert puzzle result
        db.run(
          `INSERT INTO puzzle_results
         (user_id, exercise_id, is_solved, selected_motive, attempts, correct_moves, incorrect_moves, time_spent_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            exercise_id,
            is_solved ? 1 : 0,
            selected_motive || null,
            attempts,
            correct_moves,
            incorrect_moves,
            time_spent_seconds,
          ],
          function (err) {
            if (err) {
              console.error("Error recording puzzle result:", err.message);
              return res
                .status(500)
                .json({ error: "Server error recording puzzle result" });
            }

            const resultId = this.lastID;
            console.log(
              `Puzzle result recorded for user ${userId}, exercise ${exercise_id}, solved: ${is_solved}, motive: ${exerciseMotive}, selected motive: ${selected_motive}`
            );

            // Save move times if provided
            if (
              move_times &&
              Array.isArray(move_times) &&
              move_times.length > 0
            ) {
              move_times.forEach((moveData, index) => {
                db.run(
                  `INSERT INTO puzzle_move_times
                 (puzzle_result_id, move_number, move_uci, is_correct, time_spent_ms)
                 VALUES (?, ?, ?, ?, ?)`,
                  [
                    resultId,
                    index + 1,
                    moveData.uci,
                    moveData.isCorrect ? 1 : 0,
                    moveData.timeSpentMs,
                  ],
                  (err) => {
                    if (err) {
                      console.error("Error recording move time:", err.message);
                    }
                  }
                );
              });
            }

            // Update session log stats
            db.run(
              `UPDATE session_logs
             SET puzzles_completed = puzzles_completed + 1,
                 puzzles_solved = puzzles_solved + ${is_solved ? 1 : 0}
             WHERE user_id = ? AND completed = 0`,
              [userId],
              (err) => {
                if (err) {
                  console.error(
                    "Error updating session log counters:",
                    err.message
                  );
                  // Don't block the response if this fails
                }
              }
            );

            res.status(201).json({
              message: "Puzzle result recorded successfully",
              result_id: resultId,
              already_solved: false,
            });
          }
        ); 
      }
    );
  }

    }
  );
});

// Get user's puzzle history
app.get("/api/users/puzzle-history", authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.all(
    `SELECT
       pr.id, pr.exercise_id,
       pr.is_solved, pr.attempts, pr.correct_moves,
       pr.incorrect_moves, pr.time_spent_seconds,
       pr.completed_at, e.motives, e.starting_color
     FROM puzzle_results pr
     JOIN exercises_test e ON pr.exercise_id = e.id
     WHERE pr.user_id = ?
     ORDER BY pr.completed_at DESC`,
    [userId],
    (err, results) => {
      if (err) {
        console.error("Error fetching puzzle history:", err.message);
        return res
          .status(500)
          .json({ error: "Server error fetching puzzle history" });
      }

      res.status(200).json(results);
    }
  );
});

// Get user's session history
app.get("/api/users/session-history", authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.all(
    `SELECT
       id, start_time, end_time,
       total_time_seconds, puzzles_completed,
       puzzles_solved, next_available_at
     FROM session_logs
     WHERE user_id = ? AND completed = 1
     ORDER BY end_time DESC`,
    [userId],
    (err, results) => {
      if (err) {
        console.error("Error fetching session history:", err.message);
        return res
          .status(500)
          .json({ error: "Server error fetching session history" });
      }

      res.status(200).json(results);
    }
  );
});

// Get move times for a specific puzzle result
app.get("/api/puzzles/move-times/:resultId", authenticateToken, (req, res) => {
  const resultId = req.params.resultId;

  // First check if the puzzle result belongs to the requesting user
  db.get(
    `SELECT user_id FROM puzzle_results WHERE id = ?`,
    [resultId],
    (err, result) => {
      if (err) {
        console.error("Error fetching puzzle result:", err.message);
        return res
          .status(500)
          .json({ error: "Server error fetching puzzle result" });
      }

      if (!result) {
        return res.status(404).json({ error: "Puzzle result not found" });
      }

      if (result.user_id !== req.user.id) {
        return res
          .status(403)
          .json({ error: "Unauthorized access to puzzle result" });
      }

      // Now fetch the move times
      db.all(
        `SELECT
           move_number, move_uci, is_correct, time_spent_ms, created_at
         FROM puzzle_move_times
         WHERE puzzle_result_id = ?
         ORDER BY move_number ASC`,
        [resultId],
        (err, results) => {
          if (err) {
            console.error("Error fetching move times:", err.message);
            return res
              .status(500)
              .json({ error: "Server error fetching move times" });
          }

          res.status(200).json(results);
        }
      );
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database connected: ${dbPath}`);
});
