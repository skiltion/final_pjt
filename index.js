const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const OpenAI = require("openai");
const cors = require("cors");

const app = express();
const port = 3000;
const db = new sqlite3.Database("./database.db");

app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function authenticateToken(req, res, next) {
  const token = req.header("Authorization");
  if (!token) {
    return res.status(401).json({ error: "로그인이 필요합니다." });
  }

  jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error("JWT 검증 실패:", err);  // 에러 로그 추가
      return res.status(403).json({ error: "유효하지 않은 토큰입니다." });
    }

    req.user = user;
    next();
  });
}
// 이메일 형식 검사 함수
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

app.post("/generate-recipe", authenticateToken, async (req, res) => {
  
  const { tastePreference, dishName } = req.body;

  // 🔥 로그인되지 않은 경우 즉시 반환
  if (!req.user) {
    return res.status(401).json({ error: "Login required to generate recipe." });
  }

  if (!tastePreference || !dishName) {
    return res.status(400).json({ error: "Please provide tastePreference and dishName" });
  }

  try {
    const response = await openai.chat.completions.create({ 
      model: "gpt-4",
      messages: [
        { role: "system", content: "너는 사용자의 입맛과 요청한 요리명을 바탕으로 세밀한 레시피를 제공하는 AI 셰프야." },
        { role: "user", content: `사용자의 입맛: ${tastePreference}\n요리명: ${dishName}\n\n레시피를 단계별로 상세히 작성해줘:\n1단계 :` },
      ],
      temperature: 0.7,
      max_tokens: 50,
    });

    const recipe = response.choices[0]?.message?.content || "레시피 생성 실패";

    console.log("Saving Recipe for User ID:", req.user.id);

    if (req.user) {
    db.run(
      "INSERT INTO recipes (user_id, dish_name, taste_preference, recipe, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
      [req.user.id, dishName, tastePreference, recipe], 
      function (err) {
        if (err) {
          console.error("Error saving recipe:", err);
        }
      }
    )};

    res.json({ recipe });
  } catch (error) {
    console.error("Error generating recipe:", error);
    res.status(500).json({ error: "Failed to generate recipe" });
  }
});

// 사용자의 추천 기록 조회 API (로그인한 사용자만 조회 가능)
app.get("/recipes", authenticateToken, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Login required to view recipes." });
  }

  db.all("SELECT id, dish_name, taste_preference, recipe, created_at FROM recipes WHERE user_id = ?", [req.user.id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Failed to retrieve recipes." });
    }
    res.json({ recipes: rows });
  });
});

app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  
  // 이메일과 비밀번호 입력 여부 확인
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  // 이메일 형식 검사
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Invalid email format." });
  }

  try {
    // 이메일 중복 확인
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: "Server error." });
      }
      if (user) {
        return res.status(400).json({ error: "Email is already registered." });
      }

      // 비밀번호 해싱 후 사용자 저장
      const hashedPassword = await bcrypt.hash(password, 10);
      db.run(
        "INSERT INTO users (email, password, created_at) VALUES (?, ?, datetime('now'))",
        [email, hashedPassword],
        function (err) {
          if (err) {
            return res.status(500).json({ error: "Failed to register user." });
          }
          res.status(201).json({ message: "User registered successfully." });
        }
      );
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: "Server error." });
  }
});


// 로그인 API
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: "Server error." });
    }
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // ✅ 수정: 로그인 성공 시 토큰을 클라이언트에 반환
    res.json({ token, message: "Login successful." });
  });
});

app.post("/posts", authenticateToken, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized." });

  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: "Title and content are required." });
  }

  db.run(
    "INSERT INTO posts (user_id, title, content, created_at) VALUES (?, ?, ?, datetime('now'))",
    [req.user.id, title, content],
    function (err) {
      if (err) return res.status(500).json({ error: "Failed to create post." });
      res.status(201).json({ message: "Post created successfully.", post_id: this.lastID });
    }
  );
});

// 게시글 전체 조회 API
app.get("/posts", (req, res) => {
  db.all("SELECT id, user_id, title, content, created_at FROM posts ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Failed to retrieve posts." });
    res.json({ posts: rows });
  });
});

// 특정 게시글 조회 API
app.get("/posts/:id", (req, res) => {
  const { id } = req.params;
  db.get("SELECT id, user_id, title, content, created_at FROM posts WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: "Failed to retrieve post." });
    if (!row) return res.status(404).json({ error: "Post not found." });
    res.json({ post: row });
  });
});


// 게시글 수정 API (작성자만 가능)
app.put("/posts/:id", authenticateToken, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized." });

  const { id } = req.params;
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: "Title and content are required." });
  }

  db.get("SELECT user_id FROM posts WHERE id = ?", [id], (err, post) => {
    if (err) return res.status(500).json({ error: "Failed to retrieve post." });
    if (!post) return res.status(404).json({ error: "Post not found." });
    if (post.user_id !== req.user.id) {
      return res.status(403).json({ error: "You can only edit your own posts." });
    }

    db.run("UPDATE posts SET title = ?, content = ? WHERE id = ?", [title, content, id], (err) => {
      if (err) return res.status(500).json({ error: "Failed to update post." });
      res.json({ message: "Post updated successfully." });
    });
  });
});

// 게시글 삭제 API (작성자만 가능)
app.delete("/posts/:id", authenticateToken, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized." });

  const { id } = req.params;

  db.get("SELECT user_id FROM posts WHERE id = ?", [id], (err, post) => {
    if (err) return res.status(500).json({ error: "Failed to retrieve post." });
    if (!post) return res.status(404).json({ error: "Post not found." });
    if (post.user_id !== req.user.id) {
      return res.status(403).json({ error: "You can only delete your own posts." });
    }

    db.run("DELETE FROM posts WHERE id = ?", [id], (err) => {
      if (err) return res.status(500).json({ error: "Failed to delete post." });
      res.json({ message: "Post deleted successfully." });
    });
  });
});

app.get("/user-info", authenticateToken, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  db.get("SELECT id, email, created_at FROM users WHERE id = ?", [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(500).json({ error: "Failed to retrieve user info." });
    }
    res.json({ id: user.id, email: user.email, created_at: user.created_at });
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

