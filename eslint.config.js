// @ts-check

import webConfig from "./apps/web/eslint.config.js"
import haxDesignConfig from "./packages/hax-design/eslint.config.ts"

export default [
  ...webConfig.map((config) => {
    if (config.files) return config
    return { ...config, files: ["apps/web/**/*.{js,ts,tsx}"] }
  }),
  ...haxDesignConfig.map((config) => {
    if (config.files) {
      return {
        ...config,
        files: config.files.map((pattern) => `packages/hax-design/${pattern}`),
      }
    }
    return { ...config, files: ["packages/hax-design/**/*.{js,ts,tsx}"] }
  }),
]
