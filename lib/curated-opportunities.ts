import type { OpportunityInput } from "./opportunities";

// Primary-source directory starters reviewed on 2026-10-14. These are added as
// drafts for organizer review. They imply neither an introduction nor a visit.
export const curatedOpportunities: OpportunityInput[] = [
  {
    kind: "startup", title: "LangChain", summary: "Explore open-source frameworks and tooling for building AI agents.",
    description: "LangChain builds open-source agent frameworks and LangSmith tooling. Its company page describes the team and its San Francisco headquarters. Explore the documentation and public community before deciding what to build or who to learn from. This directory entry does not include a meeting or an office visit.",
    interests: ["AI & machine learning", "Developer tools"], categories: ["learn"], area: "sf", location: "San Francisco · company headquarters",
    sourceName: "LangChain · company page", sourceUrl: "https://www.langchain.com/about", organizerPick: false, status: "draft",
  },
  {
    kind: "founder", title: "Harrison Chase · LangChain", summary: "Read the LangChain co-founder’s perspective on building agent tools.",
    description: "LangChain’s company history names Harrison Chase as a co-founder. His public writing covers agent development and the company’s journey. Use the source to research his work and prepare thoughtful questions. This is a public directory entry; Philoxenia has not confirmed an introduction or availability.",
    interests: ["AI & machine learning", "Developer tools"], categories: ["learn", "connect"], area: "sf", location: "San Francisco · LangChain headquarters",
    sourceName: "LangChain · company history", sourceUrl: "https://www.langchain.com/about", organizerPick: false, status: "draft",
  },
  {
    kind: "startup", title: "Supabase", summary: "Discover the open-source Postgres platform and its developer community.",
    description: "Supabase provides an open-source development platform built around Postgres. Y Combinator lists the company in San Francisco; Supabase describes its team as fully remote. Follow the directory link to research the product and public opportunities. This listing does not provide office access or an introduction.",
    interests: ["Developer tools"], categories: ["learn"], area: "sf", location: "San Francisco · directory location; remote team",
    sourceName: "Y Combinator · Supabase", sourceUrl: "https://www.ycombinator.com/companies/supabase/jobs", organizerPick: false, status: "draft",
  },
  {
    kind: "startup", title: "Replit", summary: "Explore browser-based software development and AI-assisted building.",
    description: "Replit develops tools for creating software in the browser. Its careers page lists roles at its Foster City office. Research the product and current public opportunities through the original source. This directory listing does not imply a meeting, office visit, internship, or introduction.",
    interests: ["AI & machine learning", "Developer tools", "Education"], categories: ["learn"], area: "bay-area", location: "Foster City · wider Bay Area",
    sourceName: "Replit · careers", sourceUrl: "https://replit.com/careers", organizerPick: false, status: "draft",
  },
];
