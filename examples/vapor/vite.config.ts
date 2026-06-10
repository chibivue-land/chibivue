import { defineConfig, mergeConfig } from "vite-plus";
import type { UserConfig } from "vite-plus";
import sharedConfig from "../../vite.config.shared";

const config: UserConfig = mergeConfig(sharedConfig, defineConfig({}));

export default config;
