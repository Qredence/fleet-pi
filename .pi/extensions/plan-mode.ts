/**
 * Fleet Pi Plan Mode Extension
 *
 * Dynamically registers Plan Mode questionnaire tools, hook filters,
 * read-only bash evaluation, and state persistence rules.
 */

import { createPlanModeExtension } from "../../apps/web/src/lib/pi/plan-mode"

export default createPlanModeExtension()
