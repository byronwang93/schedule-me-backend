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

app.post("/retrieve-personal-info", async (req, res) => {
  console.log("unique info is being fetched");
  const { originalData, shifts } = req.body;
  const {
    names,
    daysList,
    startEndTimes,
    shifts: originalDataShifts,
    unavailabilities,
  } = originalData;

  const stringNames = JSON.stringify(names);
  const stringStartEndTimes = JSON.stringify(startEndTimes);
  const stringShifts = JSON.stringify(originalDataShifts);
  const stringUnavailabilities = JSON.stringify(unavailabilities);

  const namesSchema = {
    type: "object",
    properties: {
      // names prop
      names: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            totalShifts: { type: "integer" },
            days: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  day: { type: "string", format: "date" },
                  startTime: { type: "string" },
                  endTime: { type: "string" },
                  numShifts: { type: "integer" },
                },
                required: ["day", "startTime", "endTime", "numShifts"],
              },
            },
          },
          required: ["name", "totalShifts", "days"],
        },
      },
    },
  };

  const namesCompletion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `you are a helpful assistant and you are going to build upon this shift schedule: ${shifts}.
          You are going to provide statistics for
          each person that was just scheduled. Keep in mind you only speak in JSON following
          this schema: ${JSON.stringify(
            namesSchema
          )}, do not speak normal text. Some information that could be helpful to you before starting:
            1. the days of the schedule were selected from ${stringStartEndTimes}
            2. the people that needed to be shifts were obtained from ${stringNames}
            3. the shifts that needed to be filled were obtained from ${stringShifts}
            4. the people's unavailabilities were obtained from ${stringUnavailabilities}`,
      },
      {
        role: "user",
        content: `your task is as follows:
          1. you're going to follow the format of ${JSON.stringify(
            namesSchema
          )} and you'll be filling out
            the names field in this schema
          2. identify the names of the people needing to be shifts from the
            ${stringNames}
          3. for each name, populate the names list with a separate entry for
            each name, following the schema
          4. for each of these name entries, add entries into their days list for 
            each day in the ${stringStartEndTimes} where each entry matches the information of their 
            assigned shift in ${shifts}
          5. for each name entry, keep track of how many shifts they've been assigned in total AND 
            on each separate day. The total value you would assign in the "totalShifts" field`,
      },
    ],
  });

  console.log(namesCompletion.choices[0].message, " is NAMES");
  res.json({
    completion: namesCompletion.choices[0].message,
  });
});

app.post("/make-shifts", async (req, res) => {
  const { names, daysList, startEndTimes, shifts, unavailabilities } = req.body;
  const stringNames = JSON.stringify(names);
  const stringStartEndTimes = JSON.stringify(startEndTimes);
  const stringShifts = JSON.stringify(shifts);
  const stringUnavailabilities = JSON.stringify(unavailabilities);
  console.log("shifts are being created");

  const daysSchema = {
    type: "object",
    properties: {
      // days prop
      days: {
        type: "array",
        items: {
          type: "object",
          properties: {
            day: { type: "string", format: "date" },
            shifts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  startTime: { type: "string" },
                  endTime: { type: "string" },
                  shiftLeader: { type: "string" },
                  assignedPeople: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                  required: [
                    "name",
                    "startTime",
                    "endTime",
                    "shiftLeader",
                    "assignedPeople",
                  ],
                },
              },
            },
          },
          required: ["day", "shifts"],
        },
      },
    },
  };

  const daysCompletion = await openai.chat.completions.create({
    // using gpt-4-1106-preview is pretty good
    // please use gpt-3.5-turbo-1106 for testing purposes
    model: "gpt-3.5-turbo-1106",
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant and you are going to help a user create a schedule they're planning.
          Keep in mind you only speak in JSON following this schema: ${JSON.stringify(
            daysSchema
          )}, do not speak normal text.
          The dates of the event and the starting times are specified in this array here: ${stringStartEndTimes}.
          The names of all the organizers needing a shift scheduled is in this array here: ${stringNames}.
          Every single day has a variety of different shifts that need to be fulfilled,
           so all of the shift information is in this object here which is separated by day: ${stringShifts}.
           If this shifts object for a day is empty then that means there are no shifts to be assigned for that day.
           The user also provided a list of unavailabilities in easy to count increments here: ${stringUnavailabilities}.`,
      },
      {
        role: "user",
        content: `your task is as follows:
            1. you're going to follow the format of ${JSON.stringify(
              daysSchema
            )} and you'll be filling out 
              the days field in our ${JSON.stringify(
                daysSchema
              )} for this prompt.
            2. identify the days that the event runs from the ${stringStartEndTimes} and populate your response with
              a separate entry in the days array with each day
            3. for each of these days, locate the shifts that correspond to that day from the ${stringShifts}
            4. populate that day's entry's shifts field with a separate entry for every shift that is
              happening on that day
            5. NOTE: if the shift has recurringEvent set as true, then locate it's reassignValue for 
              that shift. Remember this value because you are going to break up each shift into smaller 
              shifts so that each entry is "value" hours long (if the shift time isn't divisible by this value, 
              make the last entry only go up to the shift's end time, do not make it go past) Make sure that the 
              entire time of the shift is covered (there are no gaps of time in between).
              For example if recurringEvent was true for a "floater" shift from 10am-1pm, and the reassignValue 
              of this shift is 1, then split this shift up into 3 shifts (10am-11am, 11am-12pm, 12pm-1pm).
              Another example is if recurringEvent was true for a "floater" shift from 10am-1pm, and the reassignValue 
              of this shift is 2, then split this shift up into 2 shifts (10am-12pm, 12pm-1pm).
              If the shift has recurringEvent set as false, do NOT break it up into smaller shifts.
            6. Now you have a list of days that the event will run + the shifts happening on each 
              day. You are now going to assign shifts to people. Using the unavailabilities from 
              ${stringUnavailabilities}, iterate through all the shifts you just made and assign people that 
              are free to them. The number of people required for each shift was originally specified in the 
              ${stringShifts} so follow this. Randomly assign someone that you assigned to be the shift leader, 
              and make sure you still include their name in the assignedPeople list!!
            7. Make sure that for each shift, if there are names in its requiredNames list, try your best to shift 
                those people during that shift.
            8. Also note that each shift has a "numRequiredPeople" value which specifies how many people need to be assigned to this 
                shift. Make sure each shift gets this value fulfilled unless it is not possible.
            9. Now you're going to try to optimize this shift schedule. Try your hardest to ensure that 
              everyone has an equal number of shifts and try to make sure the groupings are not the same for each shift. 
              This is most likely impossible so try your hardest.
            10. Again, you only talk in JSON, so don't tell me about your assumptions you made or extra words.
              `,
        // EXTRA STEP 8. The last step of optimizing this shift schedule is to try not to space out an individuals shifts
        //   per day. For example if someone starts earlier, prioritize them on finishing earlier in the day
        //   and not scheduling them to be at the end of the day. Again, try your best, this doesn't always work.
      },
    ],
    response_format: { type: "json_object" },
  });

  console.log(daysCompletion.choices[0].message, " is days");
  res.json({
    completion: daysCompletion.choices[0].message,
  });
});

app.get("/", (req, res) => {
  res.json({
    name: "Billy bob",
    age: 99,
  });

  res.status(200);
});

app.listen(port, () => {
  console.log(`app listening at http://localhost:${port}`);
});
