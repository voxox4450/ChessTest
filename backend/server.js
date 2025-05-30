const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const jwt = require("jsonwebtoken");
const path = require("path");
const bcrypt = require("bcrypt");
const saltRounds = 10;

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || "chess-trainer-jwt-secret-key"; // Use env variable in production

// Middleware
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.ALLOWED_ORIGINS || "*"
        : "*",
  })
);
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
      current_session INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (group_id) REFERENCES groups(id)
    )
  `,
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
        session_id INTEGER NOT NULL,
        is_solved BOOLEAN NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        correct_moves INTEGER NOT NULL DEFAULT 0,
        incorrect_moves INTEGER NOT NULL DEFAULT 0,
        time_spent_seconds INTEGER NOT NULL DEFAULT 0,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (exercise_id) REFERENCES exercises(id),
        FOREIGN KEY (session_id) REFERENCES sessions(id)
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
        session_id INTEGER NOT NULL,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP,
        total_time_seconds INTEGER,
        puzzles_completed INTEGER NOT NULL DEFAULT 0,
        puzzles_solved INTEGER NOT NULL DEFAULT 0,
        completed BOOLEAN NOT NULL DEFAULT 0,
        next_available_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (session_id) REFERENCES sessions(id)
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
        }
      }
    );
  };
};

// API Routes
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// User registration
app.post("/api/users/register", (req, res) => {
  const { username, password } = req.body;

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

      // Count users to determine group (simple round-robin)
      db.get("SELECT COUNT(*) as count FROM users", [], (err, result) => {
        if (err) {
          console.error("Error counting users:", err.message);
          return res
            .status(500)
            .json({ error: "Server error during registration" });
        }

        const userCount = result.count;
        const assignedGroup = (userCount % 4) + 1; // Groups 1-4

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
            "INSERT INTO users (username, password, group_id, current_session) VALUES (?, ?, ?, ?)",
            [username, hashedPassword, assignedGroup, 1],
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
                { id: userId, username, group_id: assignedGroup },
                JWT_SECRET,
                { expiresIn: "24h" }
              );

              // Log registration
              console.log(
                `User registered: ${username}, Group: ${assignedGroup}, Session: 1`
              );

              res.status(201).json({
                message: "User registered successfully",
                user_id: userId,
                username,
                group_id: assignedGroup,
                current_session: 1,
                access_token: token,
              });
            }
          );
        });
      });
    }
  );
});

// User login
app.post("/api/users/login", (req, res) => {
  const { username, password } = req.body;

  // Find user
  db.get(
    "SELECT id, username, password, group_id, current_session FROM users WHERE username = ?",
    [username],
    (err, user) => {
      if (err) {
        console.error("Error finding user:", err.message);
        return res.status(500).json({ error: "Server error during login" });
      }

      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // Compare password with hash
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) {
          console.error("Error comparing passwords:", err.message);
          return res.status(500).json({ error: "Server error during login" });
        }

        if (!isMatch) {
          return res
            .status(401)
            .json({ error: "Invalid username or password" });
        }

        // Check if there's a completed session and if 24 hours have passed
        db.get(
          "SELECT * FROM session_logs WHERE user_id = ? AND completed = 1 ORDER BY end_time DESC LIMIT 1",
          [user.id],
          (err, lastSession) => {
            if (err) {
              console.error("Error checking last session:", err.message);
              return res
                .status(500)
                .json({ error: "Server error checking session availability" });
            }

            const now = new Date();

            // Only check time restriction if the user has completed a session before
            if (lastSession && lastSession.next_available_at) {
              const nextAvailable = new Date(lastSession.next_available_at);

              if (now < nextAvailable) {
                // Calculate hours left
                const hoursLeft = Math.ceil(
                  (nextAvailable - now) / (1000 * 60 * 60)
                );

                return res.status(403).json({
                  error:
                    "You cannot login yet. Please wait 24 hours between sessions.",
                  next_available_at: lastSession.next_available_at,
                  hours_left: hoursLeft,
                });
              }
            }

            // If we get here, the user can login
            // Generate token
            const token = jwt.sign(
              { id: user.id, username: user.username, group_id: user.group_id },
              JWT_SECRET,
              { expiresIn: "24h" }
            );

            // Log login
            console.log(
              `User logged in: ${user.username}, Group: ${user.group_id}, Session: ${user.current_session}`
            );

            // Add next_available_at to the response if it exists
            const loginResponse = {
              message: "Login successful",
              user_id: user.id,
              username: user.username,
              group_id: user.group_id,
              current_session: user.current_session,
              access_token: token,
            };

            if (lastSession && lastSession.next_available_at) {
              loginResponse.next_available_at = lastSession.next_available_at;
            }

            res.status(200).json(loginResponse);
          }
        );
      });
    }
  );
});

// Update user session (requires auth)
app.post("/api/users/:userId/next-session", authenticateToken, (req, res) => {
  const { userId } = req.params;
  const { current_session } = req.body;

  db.get(
    "SELECT current_session FROM users WHERE id = ?",
    [userId],
    (err, user) => {
      if (err) {
        console.error("Error finding user:", err.message);
        return res
          .status(500)
          .json({ error: "Server error during session update" });
      }

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (
        current_session !== undefined &&
        current_session !== user.current_session
      ) {
        console.error(
          `Session mismatch: Client reported ${current_session}, DB has ${user.current_session}`
        );
        return res.status(400).json({
          error: "Session validation failed",
          current_session: user.current_session,
        });
      }

      let newSession = user.current_session;

      // Only update if not already at session 5
      if (newSession < 5) {
        newSession += 1;

        db.run(
          "UPDATE users SET current_session = ? WHERE id = ?",
          [newSession, userId],
          (err) => {
            if (err) {
              console.error("Error updating session:", err.message);
              return res
                .status(500)
                .json({ error: "Server error during session update" });
            }

            // Log session update
            console.log(`User ${userId} advanced to session ${newSession}`);

            res.status(200).json({
              message: "Session updated successfully",
              current_session: newSession,
            });
          }
        );
      } else {
        res.status(200).json({
          message: "Already at maximum session",
          current_session: newSession,
        });
      }
    }
  );
});

// Get exercises for a session (requires auth)
app.get(
  "/api/exercises/group/:groupId/session/:sessionId",
  authenticateToken,
  (req, res) => {
    const { groupId, sessionId } = req.params;

    // Validate group and session
    if (groupId < 1 || groupId > 4 || sessionId < 1 || sessionId > 5) {
      return res.status(400).json({ error: "Invalid group or session" });
    }

    // Get exercises for the group and session
    db.all(
      `SELECT e.* FROM exercises e
     JOIN exercise_sessions es ON e.id = es.exercise_id
     JOIN sessions s ON es.session_id = s.id
     WHERE s.group_id = ? AND s.session_number = ?
     ORDER BY es.order_in_session`,
      [groupId, sessionId],
      (err, exercises) => {
        if (err) {
          console.error("Error fetching exercises:", err.message);
          return res
            .status(500)
            .json({ error: "Server error fetching exercises" });
        }

        // Log exercise fetch
        console.log(
          `Fetched ${exercises.length} exercises for Group ${groupId}, Session ${sessionId}`
        );

        res.status(200).json(exercises);
      }
    );
  }
);

// Start a new session
app.post("/api/sessions/start", authenticateToken, (req, res) => {
  const userId = req.user.id;
  const sessionId = req.body.session_id;

  db.get(
    "SELECT current_session FROM users WHERE id = ?",
    [userId],
    (err, user) => {
      if (err) {
        console.error("Error finding user:", err.message);
        return res.status(500).json({ error: "Server error finding user" });
      }

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user has completed all sessions (current_session = 6)
      if (user.current_session >= 6) {
        return res.status(400).json({
          error: "All sessions completed. No more sessions available.",
          all_sessions_completed: true,
        });
      }

      if (sessionId !== user.current_session) {
        console.error(
          `Session mismatch: Client requested ${sessionId}, DB has ${user.current_session}`
        );
        return res.status(400).json({
          error: "Invalid session ID",
          current_session: user.current_session,
        });
      }

      if (user.current_session > 5) {
        return res.status(400).json({
          error: "Maximum number of sessions already completed",
        });
      }

      db.get(
        "SELECT * FROM session_logs WHERE user_id = ? AND completed = 0",
        [userId],
        (err, activeSession) => {
          if (err) {
            console.error("Error checking active session:", err.message);
            return res
              .status(500)
              .json({ error: "Server error checking session" });
          }

          if (activeSession) {
            return res.status(200).json({
              message: "Session already in progress",
              session_log_id: activeSession.id,
              session_id: activeSession.session_id,
            });
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

              const twentyFourHoursInMillis = 24 * 60 * 60 * 1000;
              const now = new Date();

              if (lastSession && lastSession.end_time) {
                const lastSessionEndTime = new Date(lastSession.end_time);
                const nextAvailableTime = new Date(
                  lastSessionEndTime.getTime() + twentyFourHoursInMillis
                );

                if (now < nextAvailableTime) {
                  const timeLeft = nextAvailableTime - now;
                  const hoursLeft = Math.ceil(timeLeft / (1000 * 60 * 60));

                  return res.status(403).json({
                    error: "Session not available yet. Please wait 24 hours.",
                    next_available_at: nextAvailableTime.toISOString(),
                    hours_left: hoursLeft,
                  });
                }
              }

              db.run(
                "INSERT INTO session_logs (user_id, session_id) VALUES (?, ?)",
                [userId, sessionId],
                function (err) {
                  if (err) {
                    console.error("Error creating session log:", err.message);
                    return res
                      .status(500)
                      .json({ error: "Server error creating session log" });
                  }

                  const sessionLogId = this.lastID;
                  console.log(
                    `User ${userId} started session ${sessionId}, log ID: ${sessionLogId}`
                  );

                  res.status(201).json({
                    message: "Session started successfully",
                    session_log_id: sessionLogId,
                    session_id: sessionId,
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

// Complete a session
app.post(
  "/api/sessions/:sessionLogId/complete",
  authenticateToken,
  (req, res) => {
    const { sessionLogId } = req.params;
    const userId = req.user.id;
    const { total_time_seconds, puzzles_completed, puzzles_solved } = req.body;

    // Verify the session belongs to the user
    db.get(
      "SELECT sl.*, u.current_session FROM session_logs sl JOIN users u ON sl.user_id = u.id WHERE sl.id = ? AND sl.user_id = ?",
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
        nextAvailable.setHours(nextAvailable.getHours() + 24);

        // Check if this is the 5th session being completed
        const isFinishingFinalSession = sessionLog.session_id === 5;

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
              `User ${userId} completed session ${sessionLog.session_id}, log ID: ${sessionLogId}`
            );

            // If completing session 5, update user's current_session to 6 to indicate all sessions are completed
            if (isFinishingFinalSession) {
              db.run(
                "UPDATE users SET current_session = 6 WHERE id = ?",
                [userId],
                (err) => {
                  if (err) {
                    console.error(
                      "Error updating user session status:",
                      err.message
                    );
                    // Continue with the response even if this fails
                  } else {
                    console.log(
                      `User ${userId} has completed all sessions, updated to session 6 (completed state)`
                    );
                  }
                }
              );
            }

            res.status(200).json({
              message: "Session completed successfully",
              next_available_at: nextAvailable.toISOString(),
              all_sessions_completed: isFinishingFinalSession,
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
    session_id,
    is_solved,
    attempts,
    correct_moves,
    incorrect_moves,
    time_spent_seconds,
    move_times,
  } = req.body;

  // Check if this user has already completed this puzzle in the session
  db.get(
    `SELECT 1 FROM puzzle_results
     WHERE user_id = ? AND exercise_id = ? AND session_id = ?`,
    [userId, exercise_id, session_id],
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
        // Insert puzzle result
        db.run(
          `INSERT INTO puzzle_results
         (user_id, exercise_id, session_id, is_solved, attempts, correct_moves, incorrect_moves, time_spent_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            exercise_id,
            session_id,
            is_solved ? 1 : 0,
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
              `Puzzle result recorded for user ${userId}, exercise ${exercise_id}, solved: ${is_solved}`
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
             WHERE user_id = ? AND session_id = ? AND completed = 0`,
              [userId, session_id],
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
    }
  );
});

// Get user's puzzle history
app.get("/api/users/puzzle-history", authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.all(
    `SELECT
       pr.id, pr.exercise_id, pr.session_id,
       pr.is_solved, pr.attempts, pr.correct_moves,
       pr.incorrect_moves, pr.time_spent_seconds,
       pr.completed_at, e.motives, e.starting_color
     FROM puzzle_results pr
     JOIN exercises e ON pr.exercise_id = e.id
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
       id, session_id, start_time, end_time,
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
