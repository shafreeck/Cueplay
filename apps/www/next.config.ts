import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

// Read package.json explicitly to avoid TS resolveJsonModule issues
const pkgPath = path.join(process.cwd(), "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
};

export default nextConfig;
