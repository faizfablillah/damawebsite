import fs from "node:fs";

// Start every test run from an empty database, outbox and uploads folder.
export default function globalSetup() {
  fs.rmSync(".data-test", { recursive: true, force: true });
}
