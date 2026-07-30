import "dotenv/config";
import { createServerApp } from "./app.js";
import { LLMCore, loadLLMConfig } from "./llm/index.js";

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const llmCore = new LLMCore(loadLLMConfig());
const app = createServerApp(llmCore);

app.listen(port, "127.0.0.1", () => {
  console.info(JSON.stringify({
    event: "server_started",
    address: `http://127.0.0.1:${port}`,
  }));
});
