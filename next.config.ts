import type { NextConfig } from "next";
import { version } from "./package.json";

const nextConfig: NextConfig = {
  /*
   * The production version (lib/version.ts). `package.json`'s version only
   * moves when something goes to production, so every build carries the
   * number of the last release; VERCEL_ENV says whether this build *is* it.
   */
  env: {
    MAZO_VERSION: version,
    MAZO_ENTORNO: process.env.VERCEL_ENV ?? "development",
  },
};

export default nextConfig;
