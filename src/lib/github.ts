/**
 * Server-side GitHub REST API client.
 *
 * All GitHub token usage happens exclusively on the server.
 * This module is safe to import in Next.js API routes and Server Components.
 * It MUST NOT be imported in Client Components or browser code.
 */

import fs from 'fs';
import path from 'path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

const GITHUB_API_BASE = 'https://api.github.com';

const MAX_PUT_RETRIES = 3;
const RETRY_BACKOFF_MS = 500;

/**
 * Validates that required GitHub environment variables are configured.
 * Throws a clear error in production if missing.
 */
export function validateGitHubConfig(): void {
  const missing: string[] = [];
  if (!GITHUB_TOKEN) missing.push('GITHUB_TOKEN');
  if (!GITHUB_OWNER) missing.push('GITHUB_OWNER');
  if (!GITHUB_REPO) missing.push('GITHUB_REPO');
  if (missing.length > 0) {
    throw new Error(
      `Missing required GitHub environment variables: ${missing.join(', ')}. ` +
      'Configure these in Vercel environment variables (server-side only).'
    );
  }
}

/**
 * Returns the GitHub API headers for authenticated requests.
 * The token is never returned to the client.
 */
function githubHeaders(): Record<string, string> {
  validateGitHubConfig();
  return {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2026-03-10',
    'User-Agent': 'Patel-Restaurant-Admin',
    'Content-Type': 'application/json',
  };
}

/**
 * GitHub API response for file contents.
 */
interface GitHubFileContentResponse {
  type: string;
  encoding: string;
  size: number;
  name: string;
  path: string;
  sha: string;
  url: string;
  content: string; // base64-encoded
  download_url: string | null;
  html_url: string;
  git_url: string;
}

/**
 * GitHub API response for creating/updating a file.
 */
interface GitHubFileUpdateResponse {
  commit: {
    sha: string;
    node_id: string;
    html_url: string;
    message: string;
  };
  content: {
    name: string;
    path: string;
    sha: string;
    size: number;
    url: string;
    html_url: string;
    git_url: string;
    download_url: string;
  };
}

/**
 * Per-file write locks to serialize concurrent writes to the same GitHub file.
 * Different files can be written simultaneously; writes to the same file are queued.
 */
const fileWriteLocks = new Map<string, Promise<void>>();

/**
 * Acquires a per-file write lock. Serializes concurrent writes to the same file.
 * Different files can be written simultaneously.
 */
async function withFileLock<T>(
  filePath: string,
  operation: () => Promise<T>
): Promise<T> {
  // Chain this operation after any in-flight operation for the same file.
  const previous = fileWriteLocks.get(filePath) || Promise.resolve();

  let current: Promise<T>;
  current = (async () => {
    await previous;
    return await operation();
  })();

  // Store the promise so subsequent calls to the same file wait on this one.
  fileWriteLocks.set(filePath, current as Promise<void>);

  try {
    return await current;
  } finally {
    // Clean up the lock entry once this operation completes.
    if (fileWriteLocks.get(filePath) === current) {
      fileWriteLocks.delete(filePath);
    }
  }
}

/**
 * Sleeps for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determines whether a GitHub API error is retryable.
 * Retryable: 409 (SHA conflict) and transient 5xx errors.
 * Non-retryable: 401 (auth), 403 (permissions), 422 (validation), 404 (not found).
 */
function isRetryableError(status: number): boolean {
  return status === 409 || (status >= 500 && status < 600);
}

/**
 * Fetches raw file metadata from the GitHub content repository.
 * Returns the GitHub API response (including sha, content, encoding), or null if not found.
 */
export async function getGitHubFileMeta(
  filePath: string
): Promise<GitHubFileContentResponse | null> {
  validateGitHubConfig();

  const url = `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(filePath)}?ref=${GITHUB_BRANCH}`;

  try {
    const response = await fetch(url, {
      headers: githubHeaders(),
      cache: 'no-store',
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `GitHub API error (${response.status}) fetching metadata for ${filePath}: ${errorText}`
      );
    }

    return (await response.json()) as GitHubFileContentResponse;
  } catch (err) {
    if (err instanceof Error && err.message.includes('404')) {
      return null;
    }
    throw err;
  }
}

/**
 * Fetches a file from the GitHub content repository.
 * Returns the parsed JSON object, or null if not found.
 */
export async function getGitHubFile<T = unknown>(
  filePath: string
): Promise<T | null> {
  validateGitHubConfig();

  const meta = await getGitHubFileMeta(filePath);
  if (!meta) return null;

  if (meta.encoding !== 'base64') {
    throw new Error(`Unexpected encoding ${meta.encoding} for ${filePath}`);
  }

  const decoded = Buffer.from(meta.content, 'base64').toString('utf-8');

  try {
    return JSON.parse(decoded) as T;
  } catch {
    // Return raw string if not JSON
    return decoded as unknown as T;
  }
}

/**
 * Uploads or updates a file in the GitHub content repository.
 * Writes are serialized per-file to prevent concurrent SHA conflicts.
 * On HTTP 409 (SHA conflict), refetches the latest SHA and retries up to 3 times.
 */
export async function putGitHubFile(
  filePath: string,
  content: Buffer | string | object,
  commitMessage: string
): Promise<GitHubFileUpdateResponse> {
  validateGitHubConfig();

  return withFileLock(filePath, async () => {
    let base64Content: string;
    if (Buffer.isBuffer(content)) {
      base64Content = content.toString('base64');
    } else {
      const bodyContent =
        typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      base64Content = Buffer.from(bodyContent, 'utf-8').toString('base64');
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_PUT_RETRIES; attempt++) {
      // Fetch the latest SHA immediately before every attempt — never reuse a cached SHA.
      let sha: string | undefined;
      try {
        const existing = await getGitHubFileMeta(filePath);
        if (existing) {
          sha = existing.sha;
        }
      } catch {
        // File doesn't exist yet — that's fine for creation
      }

      const requestBody: Record<string, unknown> = {
        message: commitMessage,
        content: base64Content,
        branch: GITHUB_BRANCH,
      };

      if (sha) {
        requestBody.sha = sha;
      }

      const url = `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(filePath)}`;

      const response = await fetch(url, {
        method: 'PUT',
        headers: githubHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        return (await response.json()) as GitHubFileUpdateResponse;
      }

      const errorText = await response.text();
      const status = response.status;

      // Non-retryable errors: auth, permissions, validation, not found
      if (!isRetryableError(status)) {
        throw new Error(
          `GitHub API error (${status}) updating ${filePath}: ${errorText}`
        );
      }

      lastError = new Error(
        `GitHub API error (${status}) updating ${filePath}: ${errorText}`
      );

      // On 409 or transient error, wait briefly then retry with a fresh SHA
      if (attempt < MAX_PUT_RETRIES) {
        await sleep(RETRY_BACKOFF_MS * attempt);
      }
    }

    throw lastError || new Error(`GitHub API update failed for ${filePath}`);
  });
}

/**
 * Deletes a file from the GitHub content repository.
 * Retries on 409 SHA conflict by refetching the latest SHA.
 */
export async function deleteGitHubFile(
  filePath: string,
  commitMessage: string
): Promise<void> {
  validateGitHubConfig();

  return withFileLock(filePath, async () => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_PUT_RETRIES; attempt++) {
      const existing = await getGitHubFileMeta(filePath);
      if (!existing) {
        // File already doesn't exist
        return;
      }

      const url = `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(filePath)}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: githubHeaders(),
        body: JSON.stringify({
          message: commitMessage,
          sha: existing.sha,
          branch: GITHUB_BRANCH,
        }),
      });

      if (response.ok) {
        return;
      }

      const errorText = await response.text();
      const status = response.status;

      if (!isRetryableError(status)) {
        throw new Error(
          `GitHub API error (${status}) deleting ${filePath}: ${errorText}`
        );
      }

      lastError = new Error(
        `GitHub API error (${status}) deleting ${filePath}: ${errorText}`
      );

      if (attempt < MAX_PUT_RETRIES) {
        await sleep(RETRY_BACKOFF_MS * attempt);
      }
    }

    throw lastError || new Error(`GitHub API delete failed for ${filePath}`);
  });
}

/**
 * Lists files in a directory of the GitHub content repository.
 * Returns file metadata including download URLs.
 */
export async function listGitHubDirectory(
  dirPath: string
): Promise<Array<{
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  download_url: string | null;
  html_url: string;
}>> {
  validateGitHubConfig();

  const url = `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(dirPath)}?ref=${GITHUB_BRANCH}`;

  const response = await fetch(url, {
    headers: githubHeaders(),
    cache: 'no-store',
  });

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `GitHub API error (${response.status}) listing ${dirPath}: ${errorText}`
    );
  }

  const data = (await response.json()) as Array<{
    type: string;
    name: string;
    path: string;
    size: number;
    download_url: string | null;
    html_url: string;
  }>;

  return data.map((item) => ({
    name: item.name,
    path: item.path,
    type: item.type === 'dir' ? 'dir' : 'file',
    size: item.size,
    download_url: item.download_url,
    html_url: item.html_url,
  }));
}

/**
 * Downloads raw file bytes from GitHub (used for image proxy).
 */
export async function downloadGitHubFile(
  filePath: string
): Promise<{ buffer: Buffer; contentType: string; size: number } | null> {
  validateGitHubConfig();

  const meta = await getGitHubFileMeta(filePath);
  if (!meta) return null;

  const buffer = Buffer.from(meta.content, 'base64');

  const ext = path.extname(meta.name).toLowerCase();
  let contentType = 'application/octet-stream';
  if (ext === '.webp') contentType = 'image/webp';
  else if (ext === '.png') contentType = 'image/png';
  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.gif') contentType = 'image/gif';
  else if (ext === '.svg') contentType = 'image/svg+xml';

  return { buffer, contentType, size: meta.size };
}

export { GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH };
