import { defineCommand, runMain } from "citty";
import { init } from "./init";
import { completion } from "./completion";

const main = defineCommand({
  meta: { name: "ja2en" },
  args: { init: { type: "positional", required: false } },
  async run({ args }) {
    (args.init ? init : completion)();
  },
});

runMain(main);
