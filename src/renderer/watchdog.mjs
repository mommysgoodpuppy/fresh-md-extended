import { Worker } from 'node:worker_threads';

export function runBoundedWorker(file, request, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(file, { workerData: request,
      resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 } });
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error('Mermaid layout exceeded its 3-second time budget'));
    }, timeoutMs);
    worker.once('message', value => {
      clearTimeout(timer);
      void worker.terminate();
      if (value.error) reject(new Error(value.error));
      else resolve(value.rows);
    });
    worker.once('error', error => { clearTimeout(timer); reject(error); });
    worker.once('exit', code => {
      clearTimeout(timer);
      reject(new Error(`Mermaid layout worker exited (${code})`));
    });
  });
}
