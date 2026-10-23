import { Config } from "@remotion/cli/config";

// H.264, yuv420p, CRF 16: what the launch-motion skill asks for, and what Meta accepts as-is.
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
Config.setOverwriteOutput(true);
Config.setConcurrency(null);

// In the cloud container use the pre-installed Chromium instead of downloading one.
// Locally, leave REMOTION_CHROME unset and Remotion fetches its own headless shell.
if (process.env.REMOTION_CHROME) {
  Config.setBrowserExecutable(process.env.REMOTION_CHROME);
}
