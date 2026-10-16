export { UserPiDurable } from "./user-pi-durable"

export default {
  fetch(): Response {
    return new Response(null, { status: 404 })
  },
}
