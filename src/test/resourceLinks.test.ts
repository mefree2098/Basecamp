import { describe, expect, it } from "vitest";
import { externalResourceHref, formatResourceUrl } from "@/lib/resourceLinks";

describe("resource link helpers", () => {
  it("keeps fully qualified resource URLs intact", () => {
    expect(externalResourceHref("https://business.utah.gov/usbci/")).toBe(
      "https://business.utah.gov/usbci/"
    );
  });

  it("normalizes bare resource domains into absolute external URLs", () => {
    expect(externalResourceHref("www.daviscountyutah.gov/ced")).toBe(
      "https://www.daviscountyutah.gov/ced"
    );
  });

  it("formats exact pages without losing deep links", () => {
    expect(formatResourceUrl("https://www.sba.gov/business-guide/launch-your-business")).toBe(
      "www.sba.gov/business-guide/launch-your-business"
    );
  });
});
