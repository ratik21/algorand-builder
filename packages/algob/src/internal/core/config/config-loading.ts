import path from "path";

import { ResolvedAlgobConfig, RuntimeArgs } from "../../../types";
import { BuilderContext } from "../../context";
import { loadPluginFile } from "../plugins";
import { getUserConfigPath } from "../project-structure";
import { resolveConfig } from "./config-resolution";
import { validateConfig } from "./config-validation";

async function importCsjOrEsModule (filePath: string): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const imported = await require(filePath); // eslint-disable-line @typescript-eslint/no-var-requires
  return imported.default !== undefined ? imported.default : imported;
}

export async function loadConfigAndTasks (
  runtimeArgs?: Partial<RuntimeArgs>
): Promise<ResolvedAlgobConfig> {
  let configPath =
    runtimeArgs !== undefined ? runtimeArgs.config : undefined;

  if (configPath === undefined) {
    configPath = getUserConfigPath();
  } else {
    if (!path.isAbsolute(configPath)) {
      configPath = path.join(process.cwd(), configPath);
      configPath = path.normalize(configPath);
    }
  }

  // Before loading the builtin tasks, the default and user's config we expose
  // the config env in the global object.
  const configEnv = require("./config-env"); // eslint-disable-line @typescript-eslint/no-var-requires

  const globalAsAny = global as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  Object.entries(configEnv).forEach(
    ([key, value]) => (globalAsAny[key] = value)
  );

  loadPluginFile(path.join(__dirname, "..", "tasks", "builtin-tasks"));
  const defaultConfig = await importCsjOrEsModule("./default-config");
  const userConfig = configPath !== undefined ? await importCsjOrEsModule(configPath) : defaultConfig;
  validateConfig(userConfig);

  // To avoid bad practices we remove the previously exported stuff
  Object.keys(configEnv).forEach((key) => (globalAsAny[key] = undefined));

  return resolveConfig(
    configPath,
    defaultConfig,
    userConfig,
    BuilderContext.getBuilderContext().configExtenders
  );
}
