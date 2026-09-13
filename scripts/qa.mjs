import { _electron as electron, expect } from "@playwright/test";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const qa = resolve(".qa");
mkdirSync(qa, { recursive: true });
const dataDir = resolve(`.qa/data-${Date.now()}`);
rmSync(dataDir, { recursive: true, force: true });
let app;
const errors = [];
async function launch() {
  app = await electron.launch({
    args: ["."],
    env: { ...process.env, WORTH_DATA_DIR: dataDir },
  });
  const page = await app.firstWindow();
  page.setDefaultTimeout(8000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
  return page;
}
try {
  let page = await launch();
  await expect(page.getByText("Your whole picture starts here.")).toBeVisible();
  await page.screenshot({ path: resolve(".qa/welcome.png") });
  await expect(page.getByText("Personal", { exact: true })).toHaveCount(0);
  await expect(page.locator(".worth-footer")).toHaveCount(0);
  await expect(
    page
      .locator("main")
      .getByRole("button", { name: "Add account", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByText("Personal by design.", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /sample/i })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Export CSV", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: resolve(".qa/clean-settings.png"),
    animations: "disabled",
  });
  await page.getByLabel("Reporting currency").selectOption("AED");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  await page.getByLabel("Account name", { exact: true }).fill("QA Savings");
  await page.getByLabel("Balance", { exact: true }).fill("10000.25");
  await page.getByLabel("As of", { exact: true }).fill("2025-01-01");
  await page.getByLabel("Institution", { exact: false }).fill("Test Bank");
  await page.screenshot({ path: resolve(".qa/account-dialog.png") });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add account", exact: true })
    .click();
  await expect(page.locator(".net-worth")).toContainText("10,000");
  const chartHeight = await page
    .locator(".chart-wrap")
    .evaluate((el) => el.getBoundingClientRect().height);
  await page
    .getByRole("button", { name: "Hide balances", exact: true })
    .click();
  await expect(page.locator(".net-worth")).toContainText("••••••");
  await expect(
    page.getByText("Balances hidden", { exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator(".chart-wrap")
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBe(chartHeight);
  await expect(page.locator(".chart-plot")).toHaveCSS("visibility", "hidden");
  await page.screenshot({
    path: resolve(".qa/clean-hidden.png"),
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Show balances", exact: true })
    .click();
  await expect(page.locator(".chart-plot")).toHaveCSS("visibility", "visible");
  await page.screenshot({
    path: resolve(".qa/clean-overview.png"),
    animations: "disabled",
  });
  await expect(page.locator(".nav-block.top-actions")).toHaveCSS("gap", "0px");
  await expect(
    page.getByRole("button", { name: "Overview", exact: true }),
  ).toHaveCSS("font-size", "12px");

  await page
    .getByRole("button", { name: "Add account", exact: true })
    .first()
    .click();
  await page.getByLabel("Account name", { exact: true }).fill("QA Loan");
  await page.getByLabel("Account type", { exact: true }).selectOption("debt");
  await page.getByLabel("Amount owed", { exact: true }).fill("2000");
  await page.getByLabel("As of", { exact: true }).fill("2025-01-01");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add account", exact: true })
    .click();
  await expect(page.locator(".net-worth")).toContainText("8,000");
  await page
    .getByRole("button", { name: "QA Savings Test Bank", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Update balance", exact: true })
    .click();
  await page.getByLabel("Balance", { exact: true }).fill("12000.50");
  await page.getByLabel("As of", { exact: true }).fill("2025-02-01");
  await page.getByRole("button", { name: "Save balance", exact: true }).click();
  await expect(page.locator(".history-row")).toHaveCount(2);
  await app.close();
  page = await launch();
  await expect(page.locator(".net-worth")).toContainText("10,001");
  const stored = await page.evaluate(() => window.worth.read());
  expect(stored.accounts).toHaveLength(2);
  expect(stored.entries).toHaveLength(3);
  expect(stored.baseCurrency).toBe("AED");
  expect(await page.evaluate(() => typeof window.codexDesktop)).toBe(
    "undefined",
  );
  const backupPath = resolve(qa, "test-backup.json"),
    importPath = resolve(qa, "test-import.csv");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, backupPath);
  await page.getByRole("button", { name: "Save backup", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Backup saved");
  expect(JSON.parse(readFileSync(backupPath, "utf8"))).toEqual(stored);
  writeFileSync(
    importPath,
    "Account,Institution,Category,Currency,Date,Balance,Conversion rate,Reporting currency\nImported account,CSV,cash,USD,2025-03-01,100,3.67,AED",
  );
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [filePath],
    });
    dialog.showMessageBox = async () => ({
      response: 1,
      checkboxChecked: false,
    });
  }, importPath);
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Balances imported");
  expect(
    (await page.evaluate(() => window.worth.read())).accounts,
  ).toHaveLength(3);
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [filePath],
    });
  }, backupPath);
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Workspace restored");
  expect(await page.evaluate(() => window.worth.read())).toEqual(stored);

  await page
    .getByRole("button", { name: "Accounts", exact: false })
    .first()
    .click();
  await page.getByLabel("Search accounts").fill("Savings");
  await expect(page.locator(".account-row")).toHaveCount(1);
  await page.locator(".account-row").click();
  await page
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await page.getByLabel("Search accounts").fill("");
  await expect(page.locator(".account-row")).toHaveCount(1);
  expect(errors).toEqual([]);
  console.log(
    "PASS: compact sidebar, removed actions, stable balance privacy, account creation, liabilities, dated updates, SQLite persistence across restart, search, account deletion, JSON backup/restore, CSV import, no Codex bridge.",
  );
  await app.close();
} catch (e) {
  if (app) {
    try {
      const p = await app.firstWindow();
      await p.screenshot({ path: resolve(".qa/failure.png") });
      console.error(await p.locator("body").innerText());
    } catch {}
    await app.close();
  }
  throw e;
}
