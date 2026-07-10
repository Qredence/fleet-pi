export function isVercelDeployment() {
  return process.env.VERCEL === "1"
}

export function shouldFailClosedOnMirrorError() {
  return isVercelDeployment()
}
