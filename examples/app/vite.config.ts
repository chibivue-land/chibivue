import { defineConfig, mergeConfig } from "vite";
import sharedConfig from "../../vite.config.shared";

export default mergeConfig(sharedConfig, defineConfig({}));
