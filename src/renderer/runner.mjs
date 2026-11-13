import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import { runBoundedWorker } from './watchdog.mjs';
import { renderMermaid } from '../lib/render-mermaid.ts';

async function run() {
if (isMainThread) {
  try {
    const request = JSON.parse(process.argv[2]);
    if (typeof request.source !== 'string' || request.source.length > 4096 ||
        !Number.isFinite(request.width) || request.width < 20 || request.width > 300) {
      throw new Error('Invalid or oversized Mermaid render request');
    }
    const rows = await runBoundedWorker(__filename, request);
    process.stdout.write(JSON.stringify(rows));
  } catch (error) {
    process.stderr.write(String(error));
    process.exitCode = 1;
  }
} else {
  try {
    parentPort.postMessage({ rows: await renderMermaid(workerData.source, workerData.width) });
  } catch (error) {
    parentPort.postMessage({ error: String(error) });
  }
}
}
void run();
