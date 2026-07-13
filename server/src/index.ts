import path from "node:path";
import { pathToFileURL } from "node:url";
import { startServer } from "./app";

export { createApp, startServer } from "./app";

const entryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";

if (import.meta.url === entryUrl) {
  startServer()
    .then((server) => {
      console.log(`Prompt Forge listening on ${server.url}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
