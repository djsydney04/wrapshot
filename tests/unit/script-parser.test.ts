import { describe, expect, it } from "vitest";
import { parseScript } from "@/lib/scripts/parser";

const SAMPLE_FDX = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script">
  <Content>
    <Paragraph Type="Title"><Text>Midnight Run</Text></Paragraph>
    <Paragraph Type="Author"><Text>Jane Doe</Text></Paragraph>
    <Paragraph Type="Scene Heading"><Text>INT. APARTMENT - NIGHT</Text></Paragraph>
    <Paragraph Type="Action"><Text>A lamp flickers while rain hits the window.</Text></Paragraph>
    <Paragraph Type="Character"><Text>MAYA</Text></Paragraph>
    <Paragraph Type="Dialogue"><Text>Did you hear that?</Text></Paragraph>
  </Content>
</FinalDraft>`;

describe("script parser", () => {
  it("parses Final Draft scripts with uppercase .FDX extension", async () => {
    const parsed = await parseScript(Buffer.from(SAMPLE_FDX, "utf-8"), "Draft.FDX");

    expect(parsed.text).toContain("INT. APARTMENT - NIGHT");
    expect(parsed.text).toContain("Did you hear that?");
    expect(parsed.pageCount).toBeGreaterThanOrEqual(1);
    expect(parsed.metadata?.title).toBe("Midnight Run");
    expect(parsed.metadata?.author).toBe("Jane Doe");
  });

  it("parses Final Draft scripts from signed URLs", async () => {
    const signedUrl =
      "https://example.supabase.co/storage/v1/object/sign/scripts/project/Draft.fdx?token=abc";
    const parsed = await parseScript(Buffer.from(SAMPLE_FDX, "utf-8"), signedUrl);

    expect(parsed.text).toContain("MAYA");
  });
});
