import { describe, expect, it, vi } from "vitest";
import type { Profile } from "./api";
import { publishProfileUpdate, subscribeToProfileUpdates } from "./profile-updates";

/** A minimal saved-profile payload; only the identity fields matter to listeners. */
function profile(overrides: Partial<Profile> = {}): Profile {
  return { firstName: "Ada", lastName: "Lovelace", avatarColor: "PINK", ...overrides } as Profile;
}

describe("profile update notifications", () => {
  it("delivers the saved profile to every subscriber", () => {
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    const unsubscribeFirst = subscribeToProfileUpdates(firstListener);
    const unsubscribeSecond = subscribeToProfileUpdates(secondListener);

    const saved = profile();
    publishProfileUpdate(saved);

    expect(firstListener).toHaveBeenCalledWith(saved);
    expect(secondListener).toHaveBeenCalledWith(saved);

    unsubscribeFirst();
    unsubscribeSecond();
  });

  it("stops delivering after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToProfileUpdates(listener);

    unsubscribe();
    publishProfileUpdate(profile());

    expect(listener).not.toHaveBeenCalled();
  });

  it("still notifies the remaining listeners when one unsubscribes mid-publish", () => {
    const secondListener = vi.fn();
    const unsubscribeFirst = subscribeToProfileUpdates(() => unsubscribeFirst());
    const unsubscribeSecond = subscribeToProfileUpdates(secondListener);

    publishProfileUpdate(profile());

    expect(secondListener).toHaveBeenCalledTimes(1);
    unsubscribeSecond();
  });

  it("is a no-op when nothing is subscribed", () => {
    expect(() => publishProfileUpdate(profile())).not.toThrow();
  });
});
