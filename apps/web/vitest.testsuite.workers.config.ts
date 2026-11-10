import { defineConfig, mergeConfig } from "vitest/config"

import baseConfig from "./vitest.workers.config"

const junitOutput = process.env.FLEET_PI_JUNIT_OUTPUT

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      reporters: junitOutput
        ? [
            "default",
            [
              "junit",
              {
                addFileAttribute: true,
                includeConsoleOutput: false,
                outputFile: junitOutput,
              },
            ],
          ]
        : ["default"],
    },
  })
)
