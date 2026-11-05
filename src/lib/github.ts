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
 * Fetches a file from the GitHub content repository.
 * Returns the parsed JSON object, or null if not found.
 */
export async function getGitHubFile<T = unknown>(
  filePath: string
): Promise<T | null> {
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
        `GitHub API error (${response.status}) fetching ${filePath}: ${errorText}`
      );
    }

    const data = (await response.json()) as GitHubFileContentResponse;

    if (data.encoding !== 'base64') {
      throw new Error(`Unexpected encoding ${data.encoding} for ${filePath}`);
    }

    const decoded = Buffer.from(data.content, 'base64').toString('utf-8');

    try {
      return JSON.parse(decoded) as T;
    } catch {
      // Return raw string if not JSON
      return decoded as unknown as T;
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('404')) {
      return null;
    }
    throw err;
  }
}

/**
 * Uploads or updates a file in the GitHub content repository.
 * Always fetches the latest SHA before updating to prevent conflicts.
 */
export async function putGitHubFile(
  filePath: string,
  content: string | object,
  commitMessage: string
): Promise<GitHubFileUpdateResponse> {
  validateGitHubConfig();

  const bodyContent =
    typeof content === 'string' ? content : JSON.stringify(content, null, 2);

  const base64Content = Buffer.from(bodyContent, 'utf-8').toString('base64');

  // Fetch current file SHA if it exists (required for updates)
  let sha: string | undefined;
  try {
    const existing = await getGitHubFile<GitHubFileContentResponse>(filePath);
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `GitHub API error (${response.status}) updating ${filePath}: ${errorText}`
    );
  }

  return (await response.json()) as GitHubFileUpdateResponse;
}

/**
 * Deletes a file from the GitHub content repository.
 */
export async function deleteGitHubFile(
  filePath: string,
  commitMessage: string
): Promise<void> {
  validateGitHubConfig();

  const existing = await getGitHubFile<GitHubFileContentResponse>(filePath);
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `GitHub API error (${response.status}) deleting ${filePath}: ${errorText}`
    );
  }
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

  const file = await getGitHubFile<{
    content: string;
    encoding: string;
    size: number;
    name: string;
  }>(filePath);

  if (!file) return null;

  const buffer = Buffer.from(file.content, 'base64');

  const ext = path.extname(file.name).toLowerCase();
  let contentType = 'application/octet-stream';
  if (ext === '.webp') contentType = 'image/webp';
  else if (ext === '.png') contentType = 'image/png';
  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.gif') contentType = 'image/gif';
  else if (ext === '.svg') contentType = 'image/svg+xml';

  return { buffer, contentType, size: file.size };
}

export { GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH };