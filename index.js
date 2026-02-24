const http = require("http");
const https = require("https");
const { URLSearchParams } = require("url");
const fs = require("fs");

// 🔐 ENV
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const PORT = process.env.PORT || 3000;

// 🧠 Demo Reply Logic
function getDemoReply(text) {
  text = (text || "").toLowerCase();

  if (text.includes("fees") || text.includes("price")) {
    return "Sir, hamare gym ki monthly fees 1500 rupees hai. Quarterly aur yearly plans par discount bhi milta hai 😊";
  }

  if (text.includes("timing") || text.includes("time")) {
    return "Sir, gym subah 6 baje se raat 10 baje tak open rehta hai.";
  }

  if (text.includes("trainer")) {
    return "Ji sir, certified trainers available hain. Personal training bhi mil sakti hai.";
  }

  if (text.includes("location") || text.includes("address")) {
    return "Sir, Ansh Gym main road ke paas located hai. Easy parking available hai.";
  }

  if (text.includes("soch") || text.includes("decide")) {
    return "Bilkul sir 😊 Aap aaraam se sochiye. Agar koi doubt ho to humein call kar sakte hain.";
  }

  return "Ji sir 😊 Main aapki help ke liye yahin hoon. Aap kya jaana chahenge?";
}

// 🔊 ElevenLabs TTS
async function textToSpeech(text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2"
    });

    const options = {
      hostname: "api.elevenlabs.io",
      path: `/v1/text-to-speech/${VOICE_ID}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY
      }
    };

    const req = https.request(options, (res) => {
      const chunks = [];

      res.on("data", (chunk) => chunks.push(chunk));

      res.on("end", () => {
        const audioBuffer = Buffer.concat(chunks);
        resolve(audioBuffer.toString("base64"));
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// 📝 Logging
function logCall(data) {
  const logLine = `[${new Date().toLocaleString()}] ${data}\n`;
  fs.appendFile("call_logs.txt", logLine, () => {});
}

// 🌐 Server
const server = http.createServer(async (req, res) => {

  // 📞 Incoming Call
  if (req.url.startsWith("/voice")) {
    res.writeHead(200, { "Content-Type": "text/xml" });

    const greetingText = "Namaste 😊 Ansh Gym mein aapka swagat hai! Main aapki kaise help kar sakta hoon?";
    const audioBase64 = await textToSpeech(greetingText);

    return res.end(`
<Response>
  <Gather input="speech" action="/process" method="POST">
    <Play>data:audio/mpeg;base64,${audioBase64}</Play>
  </Gather>
</Response>
    `);
  }

  // 🎤 Process Speech
  else if (req.url.startsWith("/process")) {
    let body = "";

    req.on("data", chunk => body += chunk.toString());

    req.on("end", async () => {
      const params = new URLSearchParams(body);
      const speech = params.get("SpeechResult") || "";

      logCall(`User said: ${speech}`);

      const replyText = getDemoReply(speech);
      const audioBase64 = await textToSpeech(replyText);

      logCall(`AI replied: ${replyText}`);

      res.writeHead(200, { "Content-Type": "text/xml" });

      res.end(`
<Response>
  <Play>data:audio/mpeg;base64,${audioBase64}</Play>
  <Redirect>/voice</Redirect>
</Response>
      `);
    });
  }

  // 📊 Logs Dashboard
  else if (req.url.startsWith("/logs")) {
    fs.readFile("call_logs.txt", "utf8", (err, data) => {
      res.writeHead(200, { "Content-Type": "text/html" });

      res.end(`
        <html>
        <head>
          <title>AI Caller Logs</title>
          <style>
            body { font-family: Arial; background: #0f172a; color: white; padding: 20px; }
            pre { background: black; padding: 15px; border-radius: 10px; overflow-x: auto; }
          </style>
        </head>
        <body>
          <h2>📞 AI Caller Logs</h2>
          <pre>${data || "No logs yet..."}</pre>
        </body>
        </html>
      `);
    });
  }

  // ✅ Health Check
  else {
    res.writeHead(200);
    res.end("Server running");
  }
});

// 🚀 Start
server.listen(PORT, () => {
  console.log("Server started on port " + PORT);
});
