import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCommunityRequestType } from "./schoolMajorContract.ts";
import {
  extractCompanyCommunityItems,
  normalizeRecommendedOnboardingSpecializationsPayload,
} from "./schoolMajorContract.ts";
import { normalizeCommunitySearchKindParam } from "./schoolMajorContract.ts";

test("normalizeCommunitySearchKindParam keeps supported kinds only", () => {
  assert.equal(normalizeCommunitySearchKindParam("company"), "company");
  assert.equal(normalizeCommunitySearchKindParam("specialization"), "specialization");
  assert.equal(normalizeCommunitySearchKindParam("field"), "field");
  assert.equal(normalizeCommunitySearchKindParam("unknown"), "unknown");

  assert.equal(normalizeCommunitySearchKindParam("school"), undefined);
  assert.equal(normalizeCommunitySearchKindParam("major"), undefined);
  assert.equal(normalizeCommunitySearchKindParam("not-a-kind"), undefined);
  assert.equal(normalizeCommunitySearchKindParam(""), undefined);
});

test("normalizeCommunityRequestType maps workplace alias and keeps supported values explicit", () => {
  assert.equal(normalizeCommunityRequestType("workplace"), "company");
  assert.equal(normalizeCommunityRequestType("company"), "company");
  assert.equal(normalizeCommunityRequestType("field"), "field");
});

test("extractCompanyCommunityItems hides non-company onboarding org kinds", () => {
  const items = extractCompanyCommunityItems({
    items: [
      { id: 1, kind: "company", name: "Acme" },
      { id: 2, kind: "school", name: "State University" },
      { id: 3, kind: "specialization", name: "Finance" },
      { id: 4, kind: "company", name: "Globex", short_name: "GBX", member_count: 1200 },
    ],
  });

  assert.equal(items.length, 2);
  assert.deepEqual(
    items.map((item) => item.id),
    ["1", "4"]
  );
  assert.equal(items[1].shortName, "GBX");
  assert.equal(items[1].membersLabel, "1,200 members");
});

test("normalizeRecommendedOnboardingSpecializationsPayload is field-only", () => {
  const payload = {
    items: [
      { id: "f1", name: "Design", specialization_type: "field", member_count: 10 },
      { id: "m1", name: "Economics", specialization_type: "major", member_count: 200 },
    ],
    fields: [
      { id: "f2", name: "Engineering", member_count: 50 },
      { id: "f1", name: "Design", member_count: 20 },
    ],
    majors: [{ id: "m2", name: "Accounting", member_count: 300 }],
  };

  const all = normalizeRecommendedOnboardingSpecializationsPayload(payload, "all");
  assert.deepEqual(
    all.map((item) => item.id),
    ["f2", "f1"]
  );
  assert.ok(all.every((item) => item.type === "field"));

  const field = normalizeRecommendedOnboardingSpecializationsPayload(payload, "field");
  assert.deepEqual(
    field.map((item) => item.id),
    ["f2", "f1"]
  );
});
