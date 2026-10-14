import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { OfferInput } from "@/lib/open-doors";

export type DoorOffer = FunctionReturnType<typeof api.openDoors.catalog>[number];
export type DoorRequest = FunctionReturnType<typeof api.openDoors.requests>[number];
export type DoorActions = {
  saveOffer: (input: OfferInput, offer?: Doc<"alumniOffers">) => Promise<void>;
  request: (offer: DoorOffer, cohortId: Id<"cohorts">, goal: string, fit: string) => Promise<void>;
  respond: (request: DoorRequest, decision: "approve" | "decline" | "alternative", response: string) => Promise<void>;
  decide: (request: DoorRequest, accept: boolean) => Promise<void>;
  complete: (request: DoorRequest, response: string) => Promise<void>;
  coordinate: (request: DoorRequest, note: string) => Promise<void>;
};
