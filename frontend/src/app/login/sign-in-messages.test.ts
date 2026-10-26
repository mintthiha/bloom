import { describe, expect, it } from "vitest";
import {
  BACKEND_UNAVAILABLE_SIGN_IN_CODE,
  SERVER_UNAVAILABLE_MESSAGE,
  TOO_MANY_SIGN_IN_ATTEMPTS_CODE,
  TOO_MANY_SIGN_IN_ATTEMPTS_MESSAGE,
} from "@/lib/backend-errors";
import {
  DEMO_FAILURE_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  describeCredentialSignInFailure,
  describeDemoFailure,
} from "./sign-in-messages";

describe("describeCredentialSignInFailure", () => {
  it("explains an outage instead of blaming the password", () => {
    expect(describeCredentialSignInFailure(BACKEND_UNAVAILABLE_SIGN_IN_CODE)).toBe(
      SERVER_UNAVAILABLE_MESSAGE
    );
  });

  it("explains a lockout after too many attempts", () => {
    expect(describeCredentialSignInFailure(TOO_MANY_SIGN_IN_ATTEMPTS_CODE)).toBe(
      TOO_MANY_SIGN_IN_ATTEMPTS_MESSAGE
    );
  });

  it("treats any other code as wrong credentials", () => {
    expect(describeCredentialSignInFailure("credentials")).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(describeCredentialSignInFailure(undefined)).toBe(INVALID_CREDENTIALS_MESSAGE);
  });
});

describe("describeDemoFailure", () => {
  it("shows the backend's rate-limit reason", () => {
    expect(describeDemoFailure(429, { error: "You've started several demos recently." })).toBe(
      "You've started several demos recently."
    );
  });

  it("explains an outage for a gateway status", () => {
    expect(describeDemoFailure(503, null)).toBe(SERVER_UNAVAILABLE_MESSAGE);
  });

  it("falls back to a generic retry for anything else", () => {
    expect(describeDemoFailure(500, { error: "Internal details" })).toBe(DEMO_FAILURE_MESSAGE);
    expect(describeDemoFailure(400, null)).toBe(DEMO_FAILURE_MESSAGE);
  });
});
