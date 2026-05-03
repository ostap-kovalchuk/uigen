import { describe, test, expect, vi, beforeEach } from "vitest";
import { buildFileManagerTool } from "../file-manager";
import { VirtualFileSystem } from "@/lib/file-system";

function makeMockFs() {
  return {
    rename: vi.fn(),
    deleteFile: vi.fn(),
  } as unknown as VirtualFileSystem;
}

describe("buildFileManagerTool", () => {
  let fs: ReturnType<typeof makeMockFs>;
  let execute: (args: {
    command: "rename" | "delete";
    path: string;
    new_path?: string;
  }) => Promise<unknown>;

  beforeEach(() => {
    fs = makeMockFs();
    const tool = buildFileManagerTool(fs);
    execute = tool.execute as typeof execute;
  });

  describe("rename command", () => {
    test("returns success when rename succeeds", async () => {
      (fs.rename as any).mockReturnValue(true);
      const result = await execute({
        command: "rename",
        path: "/old.jsx",
        new_path: "/new.jsx",
      });
      expect(fs.rename).toHaveBeenCalledWith("/old.jsx", "/new.jsx");
      expect(result).toEqual({
        success: true,
        message: "Successfully renamed /old.jsx to /new.jsx",
      });
    });

    test("returns failure when rename fails", async () => {
      (fs.rename as any).mockReturnValue(false);
      const result = await execute({
        command: "rename",
        path: "/old.jsx",
        new_path: "/new.jsx",
      });
      expect(result).toEqual({
        success: false,
        error: "Failed to rename /old.jsx to /new.jsx",
      });
    });

    test("returns error when new_path is missing", async () => {
      const result = await execute({ command: "rename", path: "/old.jsx" });
      expect(fs.rename).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        error: "new_path is required for rename command",
      });
    });
  });

  describe("delete command", () => {
    test("returns success when delete succeeds", async () => {
      (fs.deleteFile as any).mockReturnValue(true);
      const result = await execute({ command: "delete", path: "/file.jsx" });
      expect(fs.deleteFile).toHaveBeenCalledWith("/file.jsx");
      expect(result).toEqual({
        success: true,
        message: "Successfully deleted /file.jsx",
      });
    });

    test("returns failure when delete fails", async () => {
      (fs.deleteFile as any).mockReturnValue(false);
      const result = await execute({ command: "delete", path: "/missing.jsx" });
      expect(result).toEqual({
        success: false,
        error: "Failed to delete /missing.jsx",
      });
    });
  });
});
