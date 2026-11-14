import os from 'node:os';
import path from 'node:path';

// Runs before each test file's imports (env is validated on import).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters!!';
process.env.AGENT_MAX_TOOL_ITERATIONS = '4';
// Uploads from tests go to a throwaway folder, never backend/uploads.
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `catalog-test-uploads-${process.pid}`);
