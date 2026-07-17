import { describe, expect, it } from "vitest";
import { APP_NAME } from "@anantaone/shared";

describe("api bootstrap", () => {
  it("loads shared package", () => {
    expect(APP_NAME).toBe("AnantaOne");
  });
});
