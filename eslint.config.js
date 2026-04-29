// @ts-check

import webConfig from "./apps/web/eslint.config.js"
import uiConfig from "./packages/ui/eslint.config.ts"

export default [
  ...webConfig.map((config) => {
    if (config.files) return config
    return { ...config, files: ["apps/web/**/*.{js,ts,tsx}"] }
  }),
  ...uiConfig.map((config) => {
    if (config.files) {
      return {
        ...config,
        files: config.files.map((pattern) => `packages/ui/${pattern}`),
      }
    }
    return { ...config, files: ["packages/ui/**/*.{js,ts,tsx}"] }
  }),
]
