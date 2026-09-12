import type { NextConfig } from "next";
import path from "node:path";

const workspaceRoot = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  // An unrelated home-directory lockfile must not become this app's root.
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot },
  // agent-core is a workspace package shipped as TypeScript source.
  transpilePackages: ["agent-core"],
};

export default nextConfig;
