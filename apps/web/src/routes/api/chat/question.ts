import { createFileRoute } from "@tanstack/react-router"
import type {
  ChatQuestionAnswerRequest,
  ChatQuestionAnswerResponse,
} from "@/lib/pi/chat-protocol"
import { answerChatQuestion } from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/question")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Partial<ChatQuestionAnswerRequest>
        if (!body.answer) {
          return new Response("Missing answer", { status: 400 })
        }

        const result: ChatQuestionAnswerResponse = answerChatQuestion(
          body as ChatQuestionAnswerRequest,
        )
        return Response.json(result, { status: result.ok ? 200 : 404 })
      },
    },
  },
})
