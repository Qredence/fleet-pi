// Schemas are defined per-domain under ./schemas. `schemas/shared` registers
// the zod-to-openapi `.openapi()` extension on the shared zod instance before
// any other fragment module is evaluated, so these re-exports are safe. The
// patched `z` helper is intentionally not re-exported (it is internal).
export {
  ChatModeSchema,
  ChatPlanActionSchema,
  ChatThinkingLevelSchema,
  ChatTransportSchema,
  ChatDeliveryModeSchema,
  ChatPackageSourceSchema,
} from "./schemas/shared"

export {
  ChatPiSettingsSchema,
  ChatPiSettingsUpdateSchema,
  ChatSettingsUpdateRequestSchema,
  ChatSettingsResponseSchema,
} from "./schemas/settings"

export {
  ChatModelSelectionSchema,
  ChatSessionMetadataSchema,
  ChatRequestSchema,
  ChatQuestionAnswerSchema,
  ChatQuestionAnswerRequestSchema,
  ChatQuestionAnswerResponseSchema,
  ChatPlanTodoSchema,
  ChatPlanStateSchema,
  ChatTextPartSchema,
  ChatErrorPartSchema,
  ChatToolPartSchema,
  ChatMessagePartSchema,
  ChatMessageSchema,
  ChatStateEventSchema,
  ChatStartEventSchema,
  ChatDeltaEventSchema,
  ChatToolEventSchema,
  ChatPlanEventSchema,
  ChatStateStreamEventSchema,
  ChatQueueEventSchema,
  ChatThinkingEventSchema,
  ChatCompactionStartEventSchema,
  ChatCompactionEndEventSchema,
  ChatRetryStartEventSchema,
  ChatRetryEndEventSchema,
  ChatDoneEventSchema,
  ChatErrorEventSchema,
  ChatStreamEventSchema,
  ChatSessionResponseSchema,
  ChatSessionInfoSchema,
  ChatSessionsResponseSchema,
} from "./schemas/chat"

export {
  ChatModelInfoSchema,
  ChatModelsResponseSchema,
  ChatModelsDiscoverRequestSchema,
  ChatModelsDiscoverResponseSchema,
  ChatResourceInfoSchema,
  ChatResourcesResponseSchema,
  WorkspaceTreeNodeSchema,
  WorkspaceTreeResponseSchema,
  ChatProviderInfoSchema,
  ChatProvidersResponseSchema,
  ChatProviderUpdateRequestSchema,
  ChatProviderUpdateResponseSchema,
  ChatProviderRemoveRequestSchema,
  ChatProviderRemoveResponseSchema,
  ChatSlashCommandInfoSchema,
  ChatCommandsResponseSchema,
} from "./schemas/catalog"

export { ErrorResponseSchema, HealthResponseSchema } from "./schemas/misc"
