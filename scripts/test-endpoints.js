const http = require("http");

function post(path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "localhost",
        port: 3000,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let bodyText = "";
        res.on("data", (chunk) => {
          bodyText += chunk;
        });
        res.on("end", () => {
          // eslint-disable-next-line no-console
          console.log(path, res.statusCode, bodyText.substring(0, 200));
          resolve();
        });
      },
    );
    req.write(data);
    req.end();
  });
}

async function run() {
  await post("/chat", { message: "hello", sessionId: "test-1" });
  await post("/rules", { text: "always ask before sending emails" });
  await post("/memory/search", { query: "hello" });
}

run();
