import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InitialsAvatar } from "./InitialsAvatar";

describe("InitialsAvatar", () => {
  it("renders the initials derived from the name", () => {
    render(<InitialsAvatar firstName="Ada" lastName="Lovelace" size={32} label="Ada Lovelace" />);

    expect(screen.getByRole("img", { name: "Ada Lovelace" })).toHaveTextContent("AL");
  });

  it("derives initials from the fallback handle when no name is saved", () => {
    render(
      <InitialsAvatar
        firstName={null}
        lastName={null}
        fallbackLabel="zoe@bloom.test"
        size={32}
        label="Your profile"
      />
    );

    expect(screen.getByRole("img", { name: "Your profile" })).toHaveTextContent("ZO");
  });

  it("prefers the profile picture when one is available", () => {
    render(
      <InitialsAvatar
        firstName="Ada"
        lastName="Lovelace"
        imageUrl="https://example.test/ada.png"
        size={32}
        label="Ada Lovelace"
      />
    );

    expect(screen.getByRole("img", { name: "Ada Lovelace" })).toHaveAttribute(
      "src",
      "https://example.test/ada.png"
    );
  });

  it("falls back to initials when the profile picture fails to load", () => {
    render(
      <InitialsAvatar
        firstName="Ada"
        lastName="Lovelace"
        imageUrl="https://example.test/broken.png"
        size={32}
        label="Ada Lovelace"
      />
    );

    fireEvent.error(screen.getByRole("img", { name: "Ada Lovelace" }));

    expect(screen.getByRole("img", { name: "Ada Lovelace" })).toHaveTextContent("AL");
  });

  it("shows a generic icon when there is nothing to build initials from", () => {
    render(<InitialsAvatar firstName={null} lastName={null} size={32} label="Your profile" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
