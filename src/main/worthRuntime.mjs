import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  shell,
  session,
} from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  chmodSync,
} from "node:fs";
import { Store, today, validateBackup } from "./worthStore.mjs";
import { header, mergeCsv } from "./worthCsv.mjs";
const here = dirname(fileURLToPath(import.meta.url));
let win;
let store;
const index = pathToFileURL(join(here, "../renderer/index.html")).href;
const devUrl = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined;
if (devUrl && !/^http:\/\/127\.0\.0\.1:\d+$/.test(devUrl))
  throw new Error("Untrusted development URL");
function handle(name, fn) {
  ipcMain.handle("worth:" + name, async (event, ...args) => {
    if (
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame ||
      event.senderFrame.url.split("#")[0] !== (devUrl ? devUrl + "/" : index)
    )
      throw new Error("Untrusted sender");
    return fn(...args);
  });
}
export function initializeWorth(window) {
  win = window;
  const folder = app.getPath("userData");
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  chmodSync(folder, 0o700);
  store = new Store(join(folder, "worth.sqlite"));
  chmodSync(join(folder, "worth.sqlite"), 0o600);
  session.defaultSession.setPermissionRequestHandler((_w, _p, cb) => cb(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Worth",
        submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      { role: "editMenu" },
      {
        label: "View",
        submenu: [
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
      { role: "windowMenu" },
    ]),
  );
  handle("read", () => store.read());
  handle("save", (input) => store.save(input));
  handle("remove", (id) => store.remove(id));
  handle("currency", (v) => store.currency(v));
  handle("location", () =>
    shell.showItemInFolder(join(folder, "worth.sqlite")),
  );
  handle("export", async (format) => {
    if (!["json", "csv", "template"].includes(format))
      throw new Error("Unsupported export format");
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title: format === "json" ? "Back up Worth" : "Export balance history",
      defaultPath:
        format === "template"
          ? "worth-import-template.csv"
          : `worth-${today()}.${format}`,
      filters: [
        {
          name: format === "json" ? "Worth backup" : "CSV",
          extensions: [format === "template" ? "csv" : format],
        },
      ],
    });
    if (canceled || !filePath) return false;
    const data = store.read();
    const cell = (v) =>
      '"' +
      String(v)
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const content =
      format === "template"
        ? header + "\r\n"
        : format === "json"
          ? JSON.stringify(data, null, 2)
          : [
              "Account,Institution,Category,Currency,Date,Balance,Conversion rate,Reporting currency",
              ...data.entries.map((e) => {
                const a = data.accounts.find((a) => a.id === e.accountId);
                return [
                  a.name,
                  a.institution,
                  a.category,
                  a.currency,
                  e.date,
                  e.amountMinor / 100,
                  e.rate,
                  data.baseCurrency,
                ]
                  .map(cell)
                  .join(",");
              }),
            ].join("\r\n");
    writeFileSync(filePath, content, { mode: 0o600 });
    return true;
  });
  handle("importCsv", async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog(win, {
      title: "Import balance history",
      properties: ["openFile"],
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (canceled) return null;
    if (statSync(filePaths[0]).size > 20 * 1024 * 1024)
      throw new Error("CSV exceeds 20 MB.");
    const merged = mergeCsv(readFileSync(filePaths[0], "utf8"), store.read());
    const answer = await dialog.showMessageBox(win, {
      type: "question",
      buttons: ["Cancel", "Import balances"],
      defaultId: 0,
      cancelId: 0,
      message: `Import ${merged.rows} balances across ${merged.created} new accounts?`,
      detail: `${merged.replaced} existing dated balances will be replaced. Accounts are matched by name, institution, and currency. A recovery backup is saved first.`,
    });
    if (answer.response !== 1) return null;
    writeFileSync(
      join(folder, `before-import-${Date.now()}.json`),
      JSON.stringify(store.read()),
      { mode: 0o600 },
    );
    return store.restore(merged.data);
  });
  handle("restore", async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog(win, {
      title: "Restore Worth backup",
      properties: ["openFile"],
      filters: [{ name: "Worth backup", extensions: ["json"] }],
    });
    if (canceled) return null;
    if (statSync(filePaths[0]).size > 20 * 1024 * 1024)
      throw new Error("Backup exceeds 20 MB.");
    const data = validateBackup(JSON.parse(readFileSync(filePaths[0], "utf8")));
    const answer = await dialog.showMessageBox(win, {
      type: "warning",
      buttons: ["Cancel", "Restore backup"],
      defaultId: 0,
      cancelId: 0,
      message: `Replace your data with ${data.accounts.length} accounts and ${data.entries.length} balances?`,
      detail:
        "A recovery copy of your current data will be saved in the Worth data folder before restoring.",
    });
    if (answer.response !== 1) return null;
    writeFileSync(
      join(folder, `before-restore-${Date.now()}.json`),
      JSON.stringify(store.read()),
      { mode: 0o600 },
    );
    return store.restore(data);
  });
}
export function setWorthWindow(window) {
  win = window;
}
export function closeWorth() {
  store?.close();
}
