import { describe, test, expect, vi, beforeEach } from "vitest";
import { buildStrReplaceTool } from "../str-replace";
import { VirtualFileSystem } from "@/lib/file-system";

function makeMockFs() {
  return {
    viewFile: vi.fn(),
    createFileWithParents: vi.fn(),
    replaceInFile: vi.fn(),
    insertInFile: vi.fn(),
  } as unknown as VirtualFileSystem;
}

describe("buildStrReplaceTool", () => {
  let fs: ReturnType<typeof makeMockFs>;
  let tool: ReturnType<typeof buildStrReplaceTool>;

  beforeEach(() => {
    fs = makeMockFs();
    tool = buildStrReplaceTool(fs);
  });

  test("has correct id", () => {
    expect(tool.id).toBe("str_replace_editor");
  });

  describe("view command", () => {
    test("delegates to viewFile with path and no range", async () => {
      (fs.viewFile as any).mockReturnValue("file contents");
      const result = await tool.execute({ command: "view", path: "/App.jsx" });
      expect(fs.viewFile).toHaveBeenCalledWith("/App.jsx", undefined);
      expect(result).toBe("file contents");
    });

    test("passes view_range through to viewFile", async () => {
      (fs.viewFile as any).mockReturnValue("lines 1-5");
      const result = await tool.execute({
        command: "view",
        path: "/App.jsx",
        view_range: [1, 5],
      });
      expect(fs.viewFile).toHaveBeenCalledWith("/App.jsx", [1, 5]);
      expect(result).toBe("lines 1-5");
    });
  });

  describe("create command", () => {
    test("delegates to createFileWithParents with path and file_text", async () => {
      (fs.createFileWithParents as any).mockReturnValue("Created /App.jsx");
      const result = await tool.execute({
        command: "create",
        path: "/App.jsx",
        file_text: "export default function App() {}",
      });
      expect(fs.createFileWithParents).toHaveBeenCalledWith(
        "/App.jsx",
        "export default function App() {}"
      );
      expect(result).toBe("Created /App.jsx");
    });

    test("uses empty string when file_text is undefined", async () => {
      (fs.createFileWithParents as any).mockReturnValue("Created /empty.js");
      await tool.execute({ command: "create", path: "/empty.js" });
      expect(fs.createFileWithParents).toHaveBeenCalledWith("/empty.js", "");
    });
  });

  describe("str_replace command", () => {
    test("delegates to replaceInFile with path, old_str, new_str", async () => {
      (fs.replaceInFile as any).mockReturnValue("Replaced successfully");
      const result = await tool.execute({
        command: "str_replace",
        path: "/App.jsx",
        old_str: "old code",
        new_str: "new code",
      });
      expect(fs.replaceInFile).toHaveBeenCalledWith(
        "/App.jsx",
        "old code",
        "new code"
      );
      expect(result).toBe("Replaced successfully");
    });

    test("uses empty strings when old_str and new_str are undefined", async () => {
      (fs.replaceInFile as any).mockReturnValue("ok");
      await tool.execute({ command: "str_replace", path: "/App.jsx" });
      expect(fs.replaceInFile).toHaveBeenCalledWith("/App.jsx", "", "");
    });
  });

  describe("insert command", () => {
    test("delegates to insertInFile with path, insert_line, new_str", async () => {
      (fs.insertInFile as any).mockReturnValue("Inserted");
      const result = await tool.execute({
        command: "insert",
        path: "/App.jsx",
        insert_line: 5,
        new_str: "const x = 1;",
      });
      expect(fs.insertInFile).toHaveBeenCalledWith("/App.jsx", 5, "const x = 1;");
      expect(result).toBe("Inserted");
    });

    test("uses 0 for insert_line and empty string for new_str when both are undefined", async () => {
      (fs.insertInFile as any).mockReturnValue("ok");
      await tool.execute({ command: "insert", path: "/App.jsx" });
      expect(fs.insertInFile).toHaveBeenCalledWith("/App.jsx", 0, "");
    });
  });

  describe("undo_edit command", () => {
    test("returns unsupported error message without touching the filesystem", async () => {
      const result = await tool.execute({ command: "undo_edit", path: "/" });
      expect(result).toContain("undo_edit command is not supported");
      expect(fs.viewFile).not.toHaveBeenCalled();
      expect(fs.createFileWithParents).not.toHaveBeenCalled();
      expect(fs.replaceInFile).not.toHaveBeenCalled();
      expect(fs.insertInFile).not.toHaveBeenCalled();
    });
  });
});
