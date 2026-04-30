import { chromium, type Page } from "playwright";
import { extractTasksWithAgent } from "../agent/extract-tasks";
import { sanitizeUrl, sanitizeVisibleText } from "../sanitize";
import type { ExtractedTask } from "../types";
import type { WorkerConfig } from "../config";

type LinkCandidate = {
  text: string;
  href: string;
};

export async function scrapeMoodleTasks(config: WorkerConfig): Promise<ExtractedTask[]> {
  if (!config.MOODLE_USERNAME || !config.MOODLE_PASSWORD) {
    throw new Error("MOODLE_USERNAME and MOODLE_PASSWORD are required for Playwright scraping");
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      baseURL: config.MOODLE_BASE_URL,
      viewport: { width: 1440, height: 1200 }
    });
    const page = await context.newPage();

    await login(page, config);
    const candidatePages = await discoverCandidatePages(page, config.MOODLE_BASE_URL);
    const tasks: ExtractedTask[] = [];

    for (const candidate of candidatePages.slice(0, 30)) {
      await page.goto(candidate.href, { waitUntil: "networkidle", timeout: 45000 });
      const pageText = sanitizeVisibleText(await page.locator("body").innerText({ timeout: 10000 }).catch(() => ""));
      const links = await collectLinks(page);

      const deterministic = extractTasksDeterministically(candidate.course, pageText, links);
      tasks.push(...deterministic);

      if (config.AGENT_ENABLED && config.OPENAI_API_KEY && deterministic.length === 0 && pageText.length > 0) {
        const agentTasks = await extractTasksWithAgent({
          apiKey: config.OPENAI_API_KEY,
          model: config.OPENAI_MODEL,
          course: candidate.course,
          pageText,
          links
        });
        tasks.push(...agentTasks);
      }
    }

    return dedupeTasks(tasks);
  } finally {
    await browser.close();
  }
}

async function login(page: Page, config: WorkerConfig) {
  await page.goto(new URL("/login/index.php", config.MOODLE_BASE_URL).toString(), {
    waitUntil: "networkidle",
    timeout: 45000
  });

  await page
    .locator('input[name="username"], input#username, input[type="email"]')
    .first()
    .fill(config.MOODLE_USERNAME ?? "");
  await page.locator('input[name="password"], input#password, input[type="password"]').first().fill(config.MOODLE_PASSWORD ?? "");

  await Promise.all([
    page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => undefined),
    page.locator('button[type="submit"], input[type="submit"], #loginbtn').first().click()
  ]);

  const bodyText = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");

  if (/senha inválida|invalid login|erro/i.test(bodyText)) {
    throw new Error("Moodle login failed");
  }
}

async function discoverCandidatePages(page: Page, baseUrl: string) {
  await page.goto(new URL("/my/", baseUrl).toString(), { waitUntil: "networkidle", timeout: 45000 }).catch(async () => {
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 45000 });
  });

  const links = await collectLinks(page);
  const courseLinks = links.filter((link) => /\/course\/view\.php|\/mod\/assign|\/calendar\/view\.php/i.test(link.href));

  if (courseLinks.length === 0) {
    return [{ course: "Moodle", href: page.url() }];
  }

  return courseLinks.map((link) => ({
    course: link.text || "Moodle",
    href: link.href
  }));
}

async function collectLinks(page: Page): Promise<LinkCandidate[]> {
  return page.locator("a[href]").evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const anchor = node as HTMLAnchorElement;
        return {
          text: (anchor.innerText || anchor.textContent || "").trim().slice(0, 180),
          href: anchor.href
        };
      })
      .filter((link) => link.href && !link.href.startsWith("javascript:"))
      .map((link) => ({ ...link, href: link.href.split("?")[0] ?? link.href }))
  );
}

function extractTasksDeterministically(course: string, pageText: string, links: LinkCandidate[]): ExtractedTask[] {
  const taskLinks = links.filter((link) => /\/mod\/(assign|quiz|forum|workshop)\//i.test(link.href));

  return taskLinks.map((link) => ({
    source: "moodle",
    course: course || "Moodle",
    title: link.text || "Tarefa Moodle",
    dueAt: inferDueDateNearText(pageText, link.text),
    moodleStatus: inferStatus(pageText, link.text),
    link: sanitizeUrl(link.href),
    raw: { extraction: "deterministic" }
  }));
}

function inferStatus(pageText: string, title: string): ExtractedTask["moodleStatus"] {
  const window = textWindow(pageText, title);

  if (/enviado|submitted|entregue/i.test(window)) return "submitted";
  if (/avaliado|graded|nota/i.test(window)) return "graded";
  if (/atrasad|vencid|overdue/i.test(window)) return "overdue";
  if (/pendente|pending|devido|prazo|vencimento/i.test(window)) return "pending";
  return "unknown";
}

function inferDueDateNearText(pageText: string, title: string) {
  const window = textWindow(pageText, title);
  const datePattern = /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:\s*(?:às|as|at)?\s*(\d{1,2}):(\d{2}))?/i;
  const match = window.match(datePattern);

  if (!match) {
    return null;
  }

  const [, day, month, year, hour = "23", minute = "59"] = match;
  const fullYear = Number(year) < 100 ? 2000 + Number(year) : Number(year);
  const date = new Date(fullYear, Number(month) - 1, Number(day), Number(hour), Number(minute));

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function textWindow(pageText: string, title: string) {
  const index = title ? pageText.toLowerCase().indexOf(title.toLowerCase()) : -1;

  if (index === -1) {
    return pageText.slice(0, 1200);
  }

  return pageText.slice(Math.max(0, index - 500), index + title.length + 900);
}

function dedupeTasks(tasks: ExtractedTask[]) {
  const seen = new Set<string>();
  const unique: ExtractedTask[] = [];

  for (const task of tasks) {
    const key = [task.source, task.externalId ?? "", task.course, task.title, task.dueAt ?? "", task.link ?? ""].join("|");

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(task);
    }
  }

  return unique;
}

