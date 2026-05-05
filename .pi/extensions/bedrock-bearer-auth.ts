import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"

export default function (pi: ExtensionAPI) {
  const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK

  if (bearerToken) {
    // Override the amazon-bedrock provider to use bearer token authentication
    pi.registerProvider("amazon-bedrock", {
      apiKey: bearerToken,
      authHeader: true, // adds Authorization: Bearer header
      headers: {
        "x-amzn-bedrock-region": process.env.AWS_REGION || "us-east-1",
      },
    })
  }
}
