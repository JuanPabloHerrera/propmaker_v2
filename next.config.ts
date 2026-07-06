import type { NextConfig } from 'next'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Resolve the deployed commit so the in-app version pill can be matched against
// the repo's latest commit. Vercel injects VERCEL_GIT_COMMIT_SHA at build time;
// locally we read it from git.
function resolveGitSha(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return ''
  }
}

const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as { version?: string }

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version ?? '0.0.0',
    NEXT_PUBLIC_GIT_SHA: resolveGitSha(),
  },
  // mammoth (DOCX text extraction) is a Node lib — keep it out of the bundle.
  // NOTE: pptxgenjs must NOT be listed here. Under Turbopack, external packages
  // are loaded at runtime via ESM import(), which resolves pptxgenjs's ESM build
  // (dist/pptxgen.es.js) — a .js file with import syntax but no "type":"module",
  // so Node loads it as CJS and throws. It has no native deps (only jszip), so
  // let Turbopack bundle it instead.
  serverExternalPackages: ['mammoth'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

export default nextConfig
