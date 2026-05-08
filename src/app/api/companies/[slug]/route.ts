import { NextResponse } from "next/server";
import { getCompanyIcon } from "@/lib/companyIcons";
import { loadCompanies } from "@/lib/data";
import type { CompanyProfileResponse } from "@/lib/types";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const company = loadCompanies().find((item) => item.slug === slug);
  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const response: CompanyProfileResponse = {
    company,
    companyIcon: (await getCompanyIcon(company)) ?? undefined
  };
  return NextResponse.json(response);
}
