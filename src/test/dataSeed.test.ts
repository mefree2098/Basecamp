import { describe, expect, it } from "vitest";
import { loadCompanies, resetDataCachesForTests } from "@/lib/data";

describe("bundled data seeds", () => {
  it("includes the imported Utah public business dataset from git", () => {
    resetDataCachesForTests();
    const companies = loadCompanies();
    const publicBusinesses = companies.filter(
      (company) => company.source?.id === "utah-open-source-places"
    );

    expect(publicBusinesses).toHaveLength(696);
    expect(companies.length).toBeGreaterThan(900);
  });
});
