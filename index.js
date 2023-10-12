import OpenAI from "openai";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import "dotenv/config";

const openai = new OpenAI({
  organization: process.env.OPENAI_ORGANIZATION,
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const port = process.env.PORT;

app.use(bodyParser.json());
app.use(cors());

app.get("/", (req, res) => {
  res.json({
    name: "Billy bob",
    age: 99,
  });

  res.status(200);
});

app.post("/testRoute", async (req, res) => {
  const { message } = req.body;

  console.log("this is running!");
  //   res.json({
  //     message: "this is a test and this is the message: " + message,
  //   });
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "assistant",
        content:
          "You are a helpful assistant tasked to create shifts for an upcoming event. You will be given a list of all the participants to schedule in addition to their unavailable times in addition to the shifts you want filled up. Each shift will also have an assigned shift leader.",
      },
      {
        role: "user",
        content:
          "The list of all the people to schedule is Alan, Byron, Gordon, Angelina, Alex.",
      },
      {
        role: "user",
        content:
          "The times you want to shift people are Nov 18, 12:00pm-2pm, Nov 18, 2:00pm-4pm, and Nov 19, 8am-10am.",
      },
      {
        role: "user",
        content:
          "These are the people unavailable for Nov 18, 12:00pm-2pm: Gordon",
      },
      {
        role: "user",
        content:
          "These are the people unavailable for Nov 18, 2:00pm-4pm: Gordon, Angelina",
      },
      {
        role: "user",
        content:
          "These are the people unavailable for Nov 19, 8am-10am: Alan, Alex",
      },
      { role: "user", content: "Nov 18, 12:00pm-2pm needs 3 people shifted." },
      { role: "user", content: "Nov 18, 2:00pm-4pm needs 2 people shifted." },
      { role: "user", content: "Nov 19, 8am-10am needs 4 people shifted." },
      {
        role: "user",
        content:
          "Can you create me a schedule for the above? Assign a shift leader for each and let me know when each person starts and stops their shifts. Try to make it so everyone has an equal number of shifts. For future iterations if I wanted to use larger data can you also make it so participants have shifts that are scheduled close to each other in time for each day?",
      },
    ],
  });

  res.json({
    completion: completion.choices[0].message,
  });
});

app.listen(port, () => {
  console.log(`app listening at http://localhost:${port}`);
});
