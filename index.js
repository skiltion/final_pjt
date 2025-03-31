const express = require("express");
const bodyParser = require("body-parser");
const OpenAI = require("openai"); // 최신 SDK 사용
require("dotenv").config();

const app = express();
const port = 3000;

app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/generate-recipe", async (req, res) => {
  const { tastePreference, dishName } = req.body;

  if (!tastePreference || !dishName) {
    return res.status(400).json({ error: "Please provide tastePreference and dishName" });
  }

  try {
    const prompt = `사용자의 입맛: ${tastePreference}\n요리명: ${dishName}\n\n레시피:\n1단계 : `;

    const response = await openai.completions.create({
      model: "gpt-3.5-turbo",
      prompt,
      max_tokens: 300,
      temperature: 0.7,
    });

    const recipe = response.choices[0].text.trim();
    res.json({ recipe });
  } catch (error) {
    console.error("Error generating recipe:", error);
    res.status(500).json({ error: "Failed to generate recipe" });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});