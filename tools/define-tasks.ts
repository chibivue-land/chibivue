import type { UserConfig } from "vite-plus";

type RunConfig = NonNullable<UserConfig["run"]>;
type TaskDefinition = NonNullable<RunConfig["tasks"]>[string];
type Command = string | string[];
type TaskObject = Exclude<TaskDefinition, Command>;

/** A task whose `dependsOn` may only name tasks defined alongside it (or `pkg#task`). */
type Task<Name extends string> = TaskObject extends infer T
  ? T extends unknown
    ? Omit<T, "dependsOn"> & { dependsOn?: Array<Name | `${string}#${string}`> }
    : never
  : never;

type Tasks<T> = { [K in keyof T]: Command | Task<Extract<keyof T, string>> };

/**
 * Typed wrapper for `run.tasks`: a typo in `dependsOn` is a type error
 * instead of a runtime "task not found".
 */
export function defineTasks<const T extends Tasks<T>>(tasks: T): RunConfig["tasks"] {
  return tasks as RunConfig["tasks"];
}
