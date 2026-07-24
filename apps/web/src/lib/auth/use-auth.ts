import {
  authClient,
  clearChatAuthBearerTokenCache,
  getChatAuthBearerToken,
} from "./client"

export const useSession = authClient.useSession
export const signIn = authClient.signIn
export const signUp = authClient.signUp

export async function signOut() {
  clearChatAuthBearerTokenCache()
  return authClient.signOut()
}

export function useOptionalUser() {
  const { data } = useSession()
  return data?.user ?? null
}

export { clearChatAuthBearerTokenCache, getChatAuthBearerToken }
