import { NextResponse } from "next/server";
import { ensureCompanyIcons } from "@/lib/companyIcons";
import { loadCompanies } from "@/lib/data";

export async function GET() {
  const companies = loadCompanies();
  const icons = await ensureCompanyIcons(companies);
  return NextResponse.json({
    icons,
    count: Object.keys(icons).length
  });
}
