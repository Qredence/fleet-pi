import { authClient } from "./client"

export const useSession = authClient.useSession
export const signIn = authClient.signIn
export const signUp = authClient.signUp
export const signOut = authClient.signOut

export function useOptionalUser() {
  const { data } = useSession()
  return data?.user ?? null
}
