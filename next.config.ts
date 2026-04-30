import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: dropped `output: "export"` to enable the /api/openai proxy route
  // (DD-024 architecture pivot — OpenAI's error responses lack CORS headers,
  // making direct browser-origin calls unviable for the wizard validation flow).
  // Gemini stays browser-direct (its CORS responses are well-formed).
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
