import fs from "node:fs";
import readline from "node:readline";
import consola from "consola";
import dotenv from "dotenv";
import { INPUT } from "./constant";

export const init = async () => {
  //  check .env
  if (!fs.existsSync(".env")) {
    consola.warn(".env not found!");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const statue = await new Promise<"continue" | "exit">((resolve) => {
      rl.question("Create .env? (y/n) ", (answer) => {
        if (["", "Y", "y", "Yes", "yes", "YES"].includes(answer)) {
          fs.writeFileSync(".env", "OPEN_AI_API_KEY= # TODO: your key");
          consola.success(".env created!");
          resolve("continue");
          rl.close();
        } else {
          resolve("exit");
          rl.close();
        }
      });
    });
    if (statue === "exit") {
      consola.fail("Please create .env first!");
      return;
    }
  }

  // check process.env.OPEN_AI_API_KEY
  // load .env
  dotenv.config();
  if (!process.env.OPEN_AI_API_KEY) {
    consola.error("OPEN_AI_API_KEY not found!");
    return;
  }

  // check input.md
  if (fs.existsSync(INPUT)) {
    consola.warn("input.md already exists!");
  } else {
    fs.writeFileSync(INPUT, "");
    consola.success("input.md created!");
  }
};
