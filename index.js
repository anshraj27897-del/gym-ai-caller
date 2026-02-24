const http = require("http");
const https = require("https");
const { URLSearchParams } = require("url");
const fs = require("fs");

// 🔐 ENV
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const PORT = process.env.PORT || 3000;

// 🎧 Memory audio
let latestAudioBuffer = null;

// 🧠 Reply Logic
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
      },
      timeout: 8000
    };

    const req = https.request(options, (res) => {
      const chunks = [];

      res.on("data", (chunk) => chunks.push(chunk));

      res.on("end", () => {
        const audioBuffer = Buffer.concat(chunks);
        resolve(audioBuffer);
      });
    });

    req.on("timeout", () => {
      req.destroy();
      reject("ElevenLabs timeout");
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

  // 🎵 AUDIO ENDPOINT
  if (req.url.startsWith("/audio")) {

    if (!latestAudioBuffer) {
      console.log("❌ No audio buffer available");

      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("Audio not ready");
    }

    res.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Content-Length": latestAudioBuffer.length
    });

    return res.end(latestAudioBuffer);
  }

  // 📞 VOICE
  if (req.url.startsWith("/voice")) {
    res.writeHead(200, { "Content-Type": "text/xml" });

    try {
      const greetingText =
        "Namaste 😊 Ansh Gym mein aapka swagat hai! Main aapki kaise help kar sakta hoon?";

      latestAudioBuffer = await textToSpeech(greetingText);

      return res.end(`
<Response>
  <Gather input="speech" action="/process" method="POST">
    <Play>https://${req.headers.host}/audio</Play>
  </Gather>
</Response>
      `);

    } catch (err) {
      console.log("🔥 TTS ERROR:", err);

      return res.end(`
<Response>
  <Say>Namaste. Ansh Gym mein aapka swagat hai.</Say>
  <Gather input="speech" action="/process" method="POST"/>
</Response>
      `);
    }
  }

  // 🎤 PROCESS
  else if (req.url.startsWith("/process")) {
    let body = "";

    req.on("data", chunk => body += chunk.toString());

    req.on("end", async () => {
      res.writeHead(200, { "Content-Type": "text/xml" });

      try {
        const params = new URLSearchParams(body);
        const speech = params.get("SpeechResult") || "";

        logCall(`User said: ${speech}`);

        const replyText = getDemoReply(speech);
        latestAudioBuffer = await textToSpeech(replyText);

        logCall(`AI replied: ${replyText}`);

        res.end(`
<Response>
  <Play>https://${req.headers.host}/audio</Play>
  <Redirect>/voice</Redirect>
</Response>
        `);

      } catch (err) {
        console.log("🔥 PROCESS ERROR:", err);

        res.end(`
<Response>
  <Say>Sorry sir, network issue aa gaya.</Say>
  <Redirect>/voice</Redirect>
</Response>
        `);
      }
    });
  }

  // 📊 LOGS
  else if (req.url.startsWith("/logs")) {
    fs.readFile("call_logs.txt", "utf8", (err, data) => {
      res.writeHead(200, { "Content-Type": "text/html" });

      res.end(`
        <html>
        <body style="font-family: Arial; background:black; color:white; padding:20px;">
          <h2>📞 AI Caller Logs</h2>
          <pre>${data || "No logs yet..."}</pre>
        </body>
        </html>
      `);
    });
  }

  // ✅ HEALTH
  else {
    res.writeHead(200);
    res.end("Server running");
  }
});

// 🚀 START
server.listen(PORT, () => {
  console.log("✅ Server started on port " + PORT);
});
